import {
    CatalogStatus,
    EnrollmentStatus,
    OrderParentType,
    OrganizationRole,
    PlatformRole,
    ProgressStatus,
    ReportStatus,
    RuleMode,
    RuleScope,
    User,
} from '@studylog/database';
import { ItemDetailsSchemas } from '@studylog/schemas';
import { Compile } from 'typebox/compile';

import { SEED_PASSWORD } from './seed-content.js';
import { buildSeedData, seededRandom, seedTables } from './seed-data.js';
import { toSlug } from './slug.js';

const NOW = new Date( '2026-09-29T15:30:00Z' );
const DAY = 24 * 60 * 60_000;

/** Ids "1", "2", ... so tests are repeatable. */
function counter() {
    let next = 0;

    return () => String( ++next );
}

const build = () => buildSeedData( { now: NOW, passwordHash: 'hash', id: counter() } );

describe( 'buildSeedData', () => {
    const data = build();
    const userId = ( email: string ) => data.users.find( ( user ) => user.email === email )?.id;
    const pathId = ( title: string ) => data.paths.find( ( path ) => path.title === title )?.id;
    const itemId = ( title: string ) => data.items.find( ( item ) => item.title === title )?.id;
    const alice = userId( 'alice@example.com' );

    it( 'is the same on every run (ids and random activity included)', () => {
        expect( build() ).toEqual( data );
    } );

    it( 'creates a superadmin and application users, all with the given password hash', () => {
        expect( data.users.map( ( user ) => [ user.email, user.platformRole ] ) ).toEqual( [
            [ 'admin@example.com', PlatformRole.Superadmin ],
            [ 'alice@example.com', PlatformRole.ApplicationUser ],
            [ 'bob@example.com', PlatformRole.ApplicationUser ],
            [ 'carol@example.com', PlatformRole.ApplicationUser ],
            [ 'dave@example.com', PlatformRole.ApplicationUser ],
        ] );
        expect( data.users.every( ( user ) => user.passwordHash === 'hash' ) ).toBe( true );
        expect( SEED_PASSWORD.length ).toBeGreaterThanOrEqual( 8 ); // the signup minimum
    } );

    it( 'gives every user a personal workspace they own, like signup does', () => {
        for ( const user of data.users ) {
            const workspace = data.organizations.find( ( org ) => org.isPersonal && org.createdById === user.id );

            expect( workspace?.name ).toBe( `${user.firstName}'s Workspace` );
            expect( workspace?.slug ).toBe( `${user.firstName?.toLowerCase()}s-workspace` );
            expect( data.memberships ).toContainEqual( expect.objectContaining( {
                userId: user.id,
                organizationId: workspace?.id,
                role: OrganizationRole.Owner,
            } ) );
        }
    } );

    it( 'creates a shared organization with members of each role and pending invitations', () => {
        const team = data.organizations.find( ( org ) => !org.isPersonal );
        const members = data.memberships.filter( ( membership ) => membership.organizationId === team?.id );

        expect( team ).toMatchObject( { name: 'Acme Study Group', slug: 'acme-study-group', createdById: alice } );
        expect( members.map( ( member ) => member.role ) )
            .toEqual( [ OrganizationRole.Owner, OrganizationRole.Admin, OrganizationRole.Member ] );
        expect( data.invitations.map( ( invitation ) => invitation.email ) )
            .toEqual( [ 'dave@example.com', 'newcomer@example.com' ] );
        expect( data.invitations[0] ).toMatchObject( {
            organizationId: team?.id,
            invitedById: alice,
            createdAt: new Date( '2026-09-27T09:00:00Z' ),
            expiresAt: new Date( '2026-10-04T09:00:00Z' ), // still valid
        } );
    } );

    it( 'has unique slugs where the database requires them', () => {
        const unique = ( values: unknown[] ) => new Set( values ).size === values.length;

        expect( unique( data.organizations.map( ( org ) => org.slug ) ) ).toBe( true );
        expect( unique( data.paths.map( ( path ) => `${path.organizationId}/${path.slug}` ) ) ).toBe( true );
        expect( unique( data.modules.map( ( module ) => `${module.learningPathId}/${module.slug}` ) ) ).toBe( true );
        expect( unique( data.topics.map( ( topic ) => `${topic.moduleId}/${topic.slug}` ) ) ).toBe( true );
        expect( unique( data.topicItems.map( ( link ) => `${link.topicId}/${link.itemId}` ) ) ).toBe( true );
        expect( unique( data.progress.map( ( row ) => `${row.userId}/${row.itemId}` ) ) ).toBe( true );
        expect( data.paths.every( ( path ) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test( path.slug! ) ) ).toBe( true );
    } );

    it( 'gives every item details the API accepts for its type', () => {
        for ( const item of data.items ) {
            const validator = Compile( ItemDetailsSchemas[item.type as keyof typeof ItemDetailsSchemas] );

            expect( validator.Check( item.details ), `${item.title}` ).toBe( true );
        }
    } );

    it( 'fills in defaults for items that leave fields out', () => {
        expect( data.items.find( ( item ) => item.title === 'How Our Sprint Works' ) ).toMatchObject( {
            difficulty: null,
            tags: [],
            status: CatalogStatus.Published,
        } );
        expect( data.items.find( ( item ) => item.title === 'Number of Islands' )?.status ).toBe( CatalogStatus.Draft );
    } );

    it( 'builds the path → module → topic → item tree, with positions and statuses', () => {
        const dsa = pathId( 'Data Structures & Algorithms' );
        const modules = data.modules.filter( ( module ) => module.learningPathId === dsa );
        const arrays = data.topics.filter( ( topic ) => topic.moduleId === modules[0]?.id );
        const hashing = data.topicItems.filter( ( link ) => link.topicId === arrays[0]?.id );

        expect( modules.map( ( module ) => [ module.title, module.slug, module.position ] ) ).toEqual( [
            [ 'Arrays & Hashing', 'arrays-hashing', 0 ],
            [ 'Linked Lists', 'linked-lists', 1 ],
            [ 'Trees', 'trees', 2 ],
            [ 'Dynamic Programming', 'dynamic-programming', 3 ],
        ] );
        expect( modules[0]?.description ).toBe( 'Most problems start here.' );
        expect( modules[1]?.description ).toBeNull();
        expect( arrays.map( ( topic ) => topic.description ) )
            .toEqual( [ null, null, 'A window over a contiguous range that grows and shrinks as you go.' ] );
        expect( hashing.map( ( link ) => [ link.position, link.isOptional ] ) )
            .toEqual( [ [ 0, false ], [ 1, false ], [ 2, false ], [ 3, true ] ] );
        expect( data.topics.find( ( topic ) => topic.title === 'Grids' )?.status ).toBe( CatalogStatus.Draft );
    } );

    it( 'puts paths in their owner\'s catalog, reusing global items in other catalogs', () => {
        const team = data.organizations.find( ( org ) => !org.isPersonal )?.id;
        const aliceWorkspace = data.organizations.find( ( org ) => org.isPersonal && org.createdById === alice )?.id;

        expect( data.paths.map( ( path ) => [ path.title, path.organizationId ] ) ).toEqual( [
            [ 'Data Structures & Algorithms', null ],
            [ 'System Design Fundamentals', null ],
            [ 'Graph Algorithms', null ],
            [ 'Interview Sprint', team ],
            [ 'Alice\'s Favourite Problems', aliceWorkspace ],
        ] );
        // "Two Sum" is one item linked into three paths.
        expect( data.items.filter( ( item ) => item.title === 'Two Sum' ) ).toHaveLength( 1 );
        expect( data.topicItems.filter( ( link ) => link.itemId === itemId( 'Two Sum' ) ) ).toHaveLength( 3 );
        expect( data.items.find( ( item ) => item.title === 'How Our Sprint Works' )?.createdById ).toBe( alice );
        expect( data.items.find( ( item ) => item.title === 'Two Sum' )?.createdById ).toBe( userId( 'admin@example.com' ) );
    } );

    it( 'enrolls users, with a rule leaving a module out and a custom topic order', () => {
        const dsa = pathId( 'Data Structures & Algorithms' );
        const enrollment = data.enrollments.find( ( row ) => row.userId === alice && row.learningPathId === dsa );
        const dp = data.modules.find( ( module ) => module.title === 'Dynamic Programming' );
        const arrays = data.modules.find( ( module ) => module.learningPathId === dsa && module.position === 0 );
        const topic = ( title: string ) =>
            data.topics.find( ( row ) => row.moduleId === arrays?.id && row.title === title )?.id;

        expect( data.enrollments.map( ( row ) => row.status ) ).toContain( EnrollmentStatus.Paused );
        expect( data.enrollmentRules ).toEqual( [
            { enrollmentId: enrollment?.id, scope: RuleScope.Module, scopeId: dp?.id, mode: RuleMode.Exclude },
        ] );
        expect( data.enrollmentOrders ).toEqual( [ {
            enrollmentId: enrollment?.id,
            parentType: OrderParentType.Module,
            parentId: arrays?.id,
            orderedIds: [ topic( 'Sliding Window' ), topic( 'Hashing Basics' ), topic( 'Two Pointers' ) ],
        } ] );
    } );

    it( 'records progress from the start of each enrollment, never on left-out or optional items', () => {
        const mine = data.progress.filter( ( row ) => row.userId === alice );
        const statuses = mine.map( ( row ) => row.status );
        const dpItems = new Set( [ 'Climbing Stairs', 'House Robber', 'Coin Change' ].map( itemId ) );

        expect( mine[0] ).toMatchObject( { itemId: itemId( 'Two Sum' ), status: ProgressStatus.Done } );
        expect( statuses ).toContain( ProgressStatus.Revise );
        expect( statuses ).toContain( ProgressStatus.InProgress );
        expect( mine.some( ( row ) => dpItems.has( row.itemId ) ) ).toBe( false );
        expect( data.progress.some( ( row ) => row.itemId === itemId( 'Hash Tables Explained' ) ) ).toBe( false );

        for ( const row of data.progress ) {
            const isFinished = row.status === ProgressStatus.Done || row.status === ProgressStatus.Revise;

            expect( row.completedAt !== null ).toBe( isFinished );
            expect( row.updatedAt ).toEqual( row.completedAt ?? row.startedAt );
        }
    } );

    it( 'logs study sessions over the last 30 days, only on items the user has started', () => {
        const started = new Set( data.progress.map( ( row ) => `${row.userId}/${row.itemId}` ) );
        const users = new Set( data.studySessions.map( ( session ) => session.userId ) );

        expect( data.studySessions.length ).toBeGreaterThan( 30 );
        expect( users ).toEqual( new Set( [ 'alice', 'bob', 'carol' ].map( ( name ) => userId( `${name}@example.com` ) ) ) );
        for ( const session of data.studySessions ) {
            const startedAt = session.startedAt!;

            expect( started.has( `${session.userId}/${session.itemId}` ) ).toBe( true );
            const { topicId, itemId: sessionItemId } = session;

            expect( data.topicItems ).toContainEqual( expect.objectContaining( { topicId, itemId: sessionItemId } ) );
            expect( startedAt.getTime() ).toBeGreaterThan( NOW.getTime() - 31 * DAY );
            expect( ( session.createdAt! ).getTime() ).toBeLessThan( NOW.getTime() );
            const endedAt = startedAt.getTime() + ( session.durationMinutes! ) * 60_000;

            expect( session.createdAt ).toEqual( new Date( endedAt ) );
        }
    } );

    it( 'reports Alice\'s public path: one resolved by the admin, one still open', () => {
        const picks = pathId( 'Alice\'s Favourite Problems' );

        expect( data.reports ).toEqual( [
            expect.objectContaining( {
                learningPathId: picks,
                reporterId: userId( 'carol@example.com' ),
                status: ReportStatus.Dismissed,
                resolvedById: userId( 'admin@example.com' ),
                resolvedAt: expect.any( Date ),
            } ),
            expect.objectContaining( {
                learningPathId: picks,
                reporterId: userId( 'bob@example.com' ),
                status: ReportStatus.Open,
                resolvedById: null,
                resolvedAt: null,
                resolutionNote: null,
            } ),
        ] );
    } );

    it( 'always builds the same rows: a change here means the dummy data changed', () => {
        expect( seedTables( data ).map( ( table ) => [ table.name, table.rows.length ] ) ).toEqual( [
            [ 'users', 5 ],
            [ 'organizations', 6 ],
            [ 'memberships', 8 ],
            [ 'invitations', 2 ],
            [ 'items', 41 ],
            [ 'learning paths', 5 ],
            [ 'modules', 9 ],
            [ 'topics', 17 ],
            [ 'topic items', 48 ],
            [ 'enrollments', 6 ],
            [ 'enrollment rules', 1 ],
            [ 'enrollment orders', 1 ],
            [ 'item progress', 34 ],
            [ 'study sessions', 51 ],
            [ 'path reports', 2 ],
        ] );
    } );

    it( 'dates everything relative to now, at set times of day (UTC)', () => {
        const carol = userId( 'carol@example.com' );

        expect( data.users[0]?.createdAt ).toEqual( new Date( '2026-07-01T09:00:00Z' ) ); // 90 days ago
        expect( data.enrollments.map( ( row ) => row.createdAt ) ).toEqual(
            [ 30, 31 ].map( ( day ) => new Date( `2026-08-${day}T09:00:00Z` ) )
                .concat( [ 1, 2, 3, 4 ].map( ( day ) => new Date( `2026-09-0${day}T09:00:00Z` ) ) ),
        );
        // One item started a day from the day after enrolling (Sep 3 and Sep 4), each done the next evening.
        const carolProgress = data.progress.filter( ( row ) => row.userId === carol );

        expect( carolProgress.map( ( row ) => [ row.status, row.startedAt, row.completedAt ] ) )
            .toEqual( [
                [ ProgressStatus.Done, new Date( '2026-09-04T18:00:00Z' ), new Date( '2026-09-05T20:00:00Z' ) ],
                [ ProgressStatus.Done, new Date( '2026-09-05T18:00:00Z' ), new Date( '2026-09-06T20:00:00Z' ) ],
                [ ProgressStatus.InProgress, new Date( '2026-09-06T18:00:00Z' ), null ],
                [ ProgressStatus.InProgress, new Date( '2026-09-07T18:00:00Z' ), null ],
                [ ProgressStatus.Done, new Date( '2026-09-05T18:00:00Z' ), new Date( '2026-09-06T20:00:00Z' ) ],
                [ ProgressStatus.InProgress, new Date( '2026-09-07T18:00:00Z' ), null ],
            ] );
        expect( data.reports.map( ( row ) => row.createdAt ) )
            .toEqual( [ new Date( '2026-09-23T09:00:00Z' ), new Date( '2026-09-28T09:00:00Z' ) ] );
    } );

    it( 'makes up the same study activity on every run', () => {
        const total = ( email: string, count: ( minutes: number ) => number ) => data.studySessions
            .filter( ( session ) => session.userId === userId( email ) )
            .reduce( ( sum, session ) => sum + count( session.durationMinutes! ), 0 );

        expect( [ 'alice', 'bob', 'carol' ].map( ( name ) => [
            total( `${name}@example.com`, () => 1 ),
            total( `${name}@example.com`, ( minutes ) => minutes ),
        ] ) ).toEqual( [ [ 32, 1660 ], [ 10, 355 ], [ 9, 435 ] ] );
        expect( data.studySessions[0] ).toMatchObject( {
            userId: alice,
            startedAt: new Date( '2026-09-01T11:00:00Z' ),
            durationMinutes: 45,
            notes: null,
        } );
        // Morning (8-12h) or afternoon (14-18h) starts, on the quarter hour.
        const starts = data.studySessions.map( ( session ) => session.startedAt! );

        expect( new Set( starts.map( ( start ) => start.getUTCMinutes() ) ) ).toEqual( new Set( [ 0, 15, 30, 45 ] ) );
        const hours = starts.map( ( start ) => start.getUTCHours() );

        expect( hours.every( ( hour ) => ( hour >= 8 && hour <= 12 ) || ( hour >= 14 && hour <= 18 ) ) ).toBe( true );
        expect( hours.some( ( hour ) => hour >= 14 ) ).toBe( true );
        expect( data.studySessions.slice( 0, 6 ).map( ( session ) => session.notes ) ).toEqual( [
            null,
            null,
            'Need to revisit this one.',
            'Finally clicked!',
            null,
            'Got stuck on the edge cases.',
        ] );
    } );

    it( 'uses random ids by default', () => {
        const { users } = buildSeedData( { now: NOW, passwordHash: 'hash' } );

        expect( users[0]?.id ).toMatch( /^[0-9a-f-]{36}$/ );
    } );
} );

describe( 'seedTables', () => {
    it( 'lists every table once, each after the tables it points at', () => {
        const tables = seedTables( build() );
        const names = tables.map( ( table ) => table.name );

        expect( tables[0] ).toMatchObject( { name: 'users', entity: User } );
        expect( new Set( names ).size ).toBe( 15 );
        expect( names.indexOf( 'organizations' ) ).toBeLessThan( names.indexOf( 'memberships' ) );
        expect( names.indexOf( 'topics' ) ).toBeLessThan( names.indexOf( 'topic items' ) );
        expect( names.indexOf( 'enrollments' ) ).toBeLessThan( names.indexOf( 'enrollment rules' ) );
        expect( names.at( -1 ) ).toBe( 'path reports' );
        expect( tables.every( ( table ) => table.rows.length > 0 ) ).toBe( true );
    } );
} );

describe( 'helpers', () => {
    it( 'seededRandom gives the same numbers for the same seed, in [0, 1)', () => {
        const a = seededRandom( 7 );
        const b = seededRandom( 7 );
        const numbers = Array.from( { length: 1000 }, a );

        expect( numbers.slice( 0, 5 ) ).toEqual( Array.from( { length: 5 }, b ) );
        expect( numbers.every( ( n ) => n >= 0 && n < 1 ) ).toBe( true );
        expect( new Set( numbers ).size ).toBeGreaterThan( 990 );
    } );

    it( 'toSlug makes URL-friendly slugs', () => {
        expect( toSlug( 'Arrays & Hashing' ) ).toBe( 'arrays-hashing' );
        expect( toSlug( '  1-D DP!' ) ).toBe( '1-d-dp' );
        expect( toSlug( 'Alice\'s Favourite Problems' ) ).toBe( 'alices-favourite-problems' );
    } );
} );
