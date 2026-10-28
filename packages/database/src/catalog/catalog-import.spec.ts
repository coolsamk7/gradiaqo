import { CatalogStatus, Difficulty, ItemType, PathVisibility } from '@studylog/schemas/enums';
import { describe, expect, it } from 'vitest';

import { Enrollment } from '../entities/enrollment.entity.js';
import { Item } from '../entities/item.entity.js';
import { LearningModule } from '../entities/learning-module.entity.js';
import { LearningPath } from '../entities/learning-path.entity.js';
import { Topic } from '../entities/topic.entity.js';
import { TopicItem } from '../entities/topic-item.entity.js';
import { fakeManager } from '../testing/fake-manager.js';
import type { CatalogItem, CatalogPath } from './catalog-file.js';
import { importPath } from './catalog-import.js';

const problem = ( slug: string, title: string, extra: Partial<CatalogItem> = {} ): CatalogItem => ( {
    type: ItemType.Problem,
    title,
    description: null,
    difficulty: Difficulty.Easy,
    estimatedMinutes: 20,
    tags: [],
    details: { url: `https://leetcode.com/problems/${slug}/`, platform: 'leetcode' },
    isOptional: false,
    ...extra,
} );
const note: CatalogItem = {
    type: ItemType.Note,
    title: 'When to use a hash map',
    description: null,
    difficulty: null,
    estimatedMinutes: null,
    tags: [],
    details: { content: 'Counting and grouping.' },
    isOptional: true,
};
const TWO_SUM = problem( 'two-sum', 'Two Sum' );

const file = ( modules: CatalogPath['modules'] = [
    {
        slug: 'arrays',
        title: 'Arrays',
        description: 'The basics.',
        topics: [
            {
                slug: 'hashing',
                title: 'Hashing',
                description: null,
                items: [ TWO_SUM, problem( 'contains-duplicate', 'Contains Duplicate' ), note ],
            },
        ],
    },
    {
        slug: 'pointers',
        title: 'Two Pointers',
        description: null,
        topics: [ { slug: 'ends', title: 'Opposite Ends', description: null, items: [ problem( 'valid-palindrome', 'Valid Palindrome' ), TWO_SUM ] } ],
    },
] ): CatalogPath => ( { slug: 'dsa', title: 'DSA', description: 'Interview prep.', modules } );

/** The topic's items in order, as "title (optional)". */
function itemsOf( db: ReturnType<typeof fakeManager>, topicSlug: string ): string[] {
    const topic = db.rows( Topic ).find( ( row ) => row.slug === topicSlug )!;

    return db.rows( TopicItem )
        .filter( ( link ) => link.topicId === topic.id )
        .sort( ( a, b ) => ( a.position as number ) - ( b.position as number ) )
        .map( ( link ) => {
            const item = db.rows( Item ).find( ( row ) => row.id === link.itemId )!;

            return `${item.title as string}${link.isOptional ? ' (optional)' : ''}`;
        } );
}

describe( 'importPath', () => {
    it( 'creates the path as a public draft after the other global paths, with everything under it published', async () => {
        const db = fakeManager();

        db.add( LearningPath, { organizationId: null, slug: 'other', position: 4 } );
        db.add( LearningPath, { organizationId: 'org', slug: 'mine', position: 9 } );

        const report = await importPath( db.manager, file() );
        const path = db.rows( LearningPath ).find( ( row ) => row.slug === 'dsa' )!;

        expect( path ).toMatchObject( {
            organizationId: null,
            title: 'DSA',
            description: 'Interview prep.',
            status: CatalogStatus.Draft,
            visibility: PathVisibility.Public,
            position: 5,
        } );
        const modules = db.rows( LearningModule );

        expect( modules.map( ( row ) => [ row.slug, row.position, row.status, row.learningPathId === path.id ] ) )
            .toEqual( [ [ 'arrays', 0, 'published', true ], [ 'pointers', 1, 'published', true ] ] );
        expect( db.rows( Topic ).map( ( row ) => [ row.slug, row.position, row.status ] ) )
            .toEqual( [ [ 'hashing', 0, 'published' ], [ 'ends', 0, 'published' ] ] );
        expect( db.rows( Item ) ).toHaveLength( 4 );
        expect( db.rows( Item )[0] ).toMatchObject( { organizationId: null, type: 'problem', status: 'published', estimatedMinutes: 20 } );
        expect( itemsOf( db, 'hashing' ) ).toEqual( [ 'Two Sum', 'Contains Duplicate', 'When to use a hash map (optional)' ] );
        // Two Sum is one item, in both topics.
        expect( itemsOf( db, 'ends' ) ).toEqual( [ 'Valid Palindrome', 'Two Sum' ] );
        expect( report ).toEqual( {
            path: { id: path.id, status: CatalogStatus.Draft, created: true, updated: false },
            modules: { created: 2, updated: 0 },
            topics: { created: 2, updated: 0 },
            items: { created: 4, updated: 0, linked: 5, unlinked: 0 },
            notInFile: [],
            unpublishedItems: [],
        } );
    } );

    it( 'is first among global paths when there are none yet', async () => {
        const db = fakeManager();

        await importPath( db.manager, file() );

        expect( db.rows( LearningPath )[0].position ).toBe( 0 );
    } );

    it( 'changes nothing the second time', async () => {
        const db = fakeManager();

        await importPath( db.manager, file() );
        // Each item is looked up once, though Two Sum is in two topics.
        expect( db.calls.itemLookups ).toBe( 3 );
        db.calls.saves = 0;
        db.calls.updates = 0;
        const report = await importPath( db.manager, file() );

        // Nothing written when nothing changed.
        expect( db.calls ).toMatchObject( { saves: 0, updates: 0 } );

        expect( report ).toMatchObject( {
            path: { created: false, updated: false },
            modules: { created: 0, updated: 0 },
            topics: { created: 0, updated: 0 },
            items: { created: 0, updated: 0, linked: 0, unlinked: 0 },
        } );
        expect( db.rows( LearningPath ) ).toHaveLength( 1 );
        expect( db.rows( Item ) ).toHaveLength( 4 );
    } );

    it( 'changes nothing when the database stored the details with their keys in another order', async () => {
        const db = fakeManager();
        const book: CatalogItem = {
            ...note,
            type: ItemType.Book,
            title: 'Designing Data-Intensive Applications',
            details: { author: 'Martin Kleppmann', chapters: '5', isbn: '9781449373320' },
        };
        const exercise: CatalogItem = {
            ...note,
            type: ItemType.Exercise,
            title: 'Estimate',
            details: { instructions: 'How many?', answer: 'About 100.' },
        };
        const withBoth = file( [ { ...file().modules[0], topics: [ { slug: 'reading', title: 'Reading', description: null, items: [ book, exercise ] } ] } ] );

        await importPath( db.manager, withBoth );
        // Like Postgres jsonb, which keeps keys shortest first: { isbn, author, chapters }, { answer, instructions }.
        for ( const item of db.rows( Item ) ) {
            const details = item.details as Record<string, unknown>;

            const keys = Object.keys( details ).sort( ( a, b ) => a.length - b.length || a.localeCompare( b ) );

            item.details = Object.fromEntries( keys.map( ( key ) => [ key, details[key] ] ) );
        }
        db.calls.saves = 0;

        const report = await importPath( db.manager, withBoth );

        expect( report.items ).toMatchObject( { created: 0, updated: 0 } );
        expect( db.calls.saves ).toBe( 0 );
    } );

    it( 'brings existing content up to date, keeping statuses, and reports what the file left out', async () => {
        const db = fakeManager();

        await importPath( db.manager, file() );
        for ( const row of [ ...db.rows( LearningPath ), ...db.rows( LearningModule ) ] ) {
            row.status = CatalogStatus.Published;
        }
        const savesBefore = db.calls.saves;

        const report = await importPath( db.manager, {
            slug: 'dsa',
            title: 'Data Structures & Algorithms',
            description: 'Interview prep.',
            modules: [
                {
                    slug: 'pointers',
                    title: 'Two Pointers',
                    description: 'Moved first.',
                    topics: [
                        {
                            slug: 'ends',
                            title: 'Opposite Ends',
                            description: null,
                            items: [ TWO_SUM, problem( 'valid-palindrome', 'Valid Palindrome', { tags: [ 'strings' ] } ) ],
                        },
                    ],
                },
                {
                    slug: 'arrays',
                    title: 'Arrays',
                    description: 'The basics.',
                    topics: [ { slug: 'hashing', title: 'Hash Maps', description: null, items: [ { ...note, isOptional: false }, TWO_SUM ] } ],
                },
            ],
        } );

        expect( db.rows( LearningPath )[0] ).toMatchObject( { title: 'Data Structures & Algorithms', status: CatalogStatus.Published } );
        const modules = db.rows( LearningModule )
            .map( ( row ) => [ row.slug, row.position, row.description, row.status ] );

        expect( modules ).toEqual( [
            [ 'arrays', 1, 'The basics.', 'published' ],
            [ 'pointers', 0, 'Moved first.', 'published' ],
        ] );
        expect( db.rows( Topic ).find( ( row ) => row.slug === 'hashing' )!.title ).toBe( 'Hash Maps' );
        expect( itemsOf( db, 'hashing' ) ).toEqual( [ 'When to use a hash map', 'Two Sum' ] );
        expect( itemsOf( db, 'ends' ) ).toEqual( [ 'Two Sum', 'Valid Palindrome' ] );
        // The path, both modules, one topic and one item saved; four links moved or made required.
        expect( db.calls.saves - savesBefore ).toBe( 5 );
        expect( db.calls.updates ).toBe( 4 );
        // Taken out of the topic, but still in the catalog.
        expect( db.rows( Item ).some( ( row ) => row.title === 'Contains Duplicate' ) ).toBe( true );
        expect( report ).toMatchObject( {
            path: { status: CatalogStatus.Published, created: false, updated: true },
            modules: { created: 0, updated: 2 },
            topics: { created: 0, updated: 1 },
            items: { created: 0, updated: 1, linked: 0, unlinked: 1 },
            notInFile: [],
        } );

        const reduced = await importPath( db.manager, file( [
            { slug: 'arrays', title: 'Arrays', description: 'The basics.', topics: [ { slug: 'new', title: 'New', description: null, items: [ TWO_SUM ] } ] },
        ] ) );

        expect( reduced.notInFile ).toEqual( [ 'topic "Hash Maps" in "Arrays"', 'module "Two Pointers"' ] );
        expect( db.rows( LearningModule ) ).toHaveLength( 2 );
    } );

    it( 'imports into an organization: a private path, usable right away, of its own items', async () => {
        const db = fakeManager();
        const official = db.add( Item, { organizationId: null, type: ItemType.Problem, title: 'Two Sum', details: { ...TWO_SUM.details } } );
        const officialNote = db.add( Item, { organizationId: null, type: ItemType.Note, title: note.title, details: { content: 'Official.' } } );

        db.add( Enrollment, { userId: 'user-1', learningPathId: 'other', position: 3 } );
        const owner = { organizationId: 'org-1', userId: 'user-1', enroll: true };
        const report = await importPath( db.manager, file(), owner );
        const [ path ] = db.rows( LearningPath );

        expect( path ).toMatchObject( {
            organizationId: 'org-1',
            status: CatalogStatus.Published,
            visibility: PathVisibility.Private,
            position: 0,
            createdById: 'user-1',
        } );
        expect( report.path ).toMatchObject( { created: true, status: CatalogStatus.Published } );
        // Its own copies: the official items are neither used nor changed.
        expect( report.items.created ).toBe( 4 );
        expect( db.rows( Item ).filter( ( row ) => row.organizationId === 'org-1' ) ).toHaveLength( 4 );
        expect( db.rows( Item ).filter( ( row ) => row.organizationId === 'org-1' ).map( ( row ) => row.createdById ) )
            .toEqual( [ 'user-1', 'user-1', 'user-1', 'user-1' ] );
        expect( official.title ).toBe( 'Two Sum' );
        expect( officialNote.details ).toEqual( { content: 'Official.' } );
        expect( db.rows( Enrollment ).at( -1 ) ).toMatchObject( { userId: 'user-1', learningPathId: path.id, position: 4 } );

        const again = await importPath( db.manager, file(), owner );

        expect( again ).toMatchObject( { path: { created: false }, items: { created: 0, updated: 0, linked: 0 } } );
        expect( db.rows( Enrollment ) ).toHaveLength( 2 );
    } );

    it( 'enrolls nobody unless asked, and starts at 1 for someone with no paths yet', async () => {
        const db = fakeManager();

        await importPath( db.manager, file(), { organizationId: 'org-1', userId: 'user-1' } );
        expect( db.rows( Enrollment ) ).toHaveLength( 0 );

        await importPath( db.manager, { ...file(), slug: 'other' }, { organizationId: 'org-1', userId: 'user-2', enroll: true } );
        expect( db.rows( Enrollment ) ).toEqual( [ expect.objectContaining( { userId: 'user-2', position: 1 } ) ] );

        // Without a user: no creator, and nobody to enroll.
        await importPath( db.manager, { ...file(), slug: 'third' }, { organizationId: 'org-2', enroll: true } );
        expect( db.rows( LearningPath ).at( -1 ) ).toMatchObject( { organizationId: 'org-2', createdById: null } );
        expect( db.rows( Enrollment ) ).toHaveLength( 1 );
    } );

    it( 'finds items by type and URL, or by type and title without one, and only global ones', async () => {
        const db = fakeManager();

        db.add( Item, { organizationId: 'org', type: ItemType.Problem, title: 'Their copy', details: { url: TWO_SUM.details.url } } );
        db.add( Item, {
            organizationId: null,
            type: ItemType.Problem,
            title: 'Two Sum (old title)',
            details: { url: TWO_SUM.details.url },
            status: CatalogStatus.Published,
        } );
        db.add( Item, { organizationId: null, type: ItemType.Note, title: note.title, details: { content: 'Old.' }, status: CatalogStatus.Archived } );

        const report = await importPath( db.manager, file() );

        // The import doesn't change an existing item's status, but says it's hidden.
        expect( report.unpublishedItems ).toEqual( [ '"When to use a hash map" (archived)' ] );

        expect( db.rows( Item ).filter( ( row ) => row.organizationId === null ) ).toHaveLength( 4 );
        expect( db.rows( Item ).find( ( row ) => row.organizationId === 'org' )!.title ).toBe( 'Their copy' );
        expect( db.rows( Item ).find( ( row ) => row.type === ItemType.Note )!.details ).toEqual( { content: 'Counting and grouping.' } );
        expect( report.items ).toMatchObject( { created: 2, updated: 2 } );
    } );
} );
