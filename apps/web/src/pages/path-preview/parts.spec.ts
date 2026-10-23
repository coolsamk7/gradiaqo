import { EnrollmentStatus, ItemType, RuleMode, RuleScope } from '@studylog/schemas/enums';

import { ApiError, NetworkError } from '../../api/client.ts';
import { formatMonth } from '../../format/format.ts';
import type { TreeSpec } from '../../test/fixtures.ts';
import { enrollment, enrollmentDetail, publishedPath, uuid } from '../../test/fixtures.ts';
import {
    allTopics,
    countItems,
    describeParts,
    followedTopics,
    moduleState,
    rulesFor,
    toggleModule,
    toggleTopic,
} from './parts.ts';
import { enrollError, itemLine, sourceName } from './preview.ts';

const SHARED = { id: uuid( 99 ), title: 'Shared Item' };

const SPEC: TreeSpec[] = [
    { title: 'Foundations', topics: [
        { id: uuid( 1 ), title: 'Scalability', items: [ { id: uuid( 11 ), title: 'A' }, SHARED ] },
        { id: uuid( 2 ), title: 'Caching', items: [ { id: uuid( 12 ), title: 'B' } ] },
    ] },
    { title: 'Data', topics: [
        { id: uuid( 3 ), title: 'Databases', items: [ { id: uuid( 13 ), title: 'C' }, SHARED ] },
        { id: uuid( 4 ), title: 'Distributed Systems', items: [ { id: uuid( 14 ), title: 'D' } ] },
    ] },
    { title: 'Practice', topics: [ { id: uuid( 5 ), title: 'Design Exercises', items: [ { id: uuid( 15 ), title: 'E' } ] } ] },
    { title: 'Empty', topics: [] },
];

const MODULES = publishedPath( 'System Design', SPEC ).modules;

type Module = ( typeof MODULES )[number];
const [ FOUNDATIONS, DATA, PRACTICE ] = MODULES as [ Module, Module, Module ];

describe( 'parts', () => {
    it( 'ticks every topic, or the ones an enrollment shows', () => {
        expect( [ ...allTopics( MODULES ) ] ).toEqual( [ uuid( 1 ), uuid( 2 ), uuid( 3 ), uuid( 4 ), uuid( 5 ) ] );

        const detail = enrollmentDetail( enrollment( 'System Design', EnrollmentStatus.Active, 0, 3 ), [
            SPEC[0],
            { title: 'Data', topics: [ SPEC[1].topics[0] ] },
            // A topic the published path no longer has.
            { title: 'Old', topics: [ { id: uuid( 6 ), title: 'Gone', items: [] } ] },
        ] );

        expect( [ ...followedTopics( MODULES, detail ) ] ).toEqual( [ uuid( 1 ), uuid( 2 ), uuid( 3 ) ] );
    } );

    it( 'knows whether a module is ticked, and toggles it', () => {
        const some = new Set( [ uuid( 3 ) ] );

        expect( moduleState( FOUNDATIONS, allTopics( MODULES ) ) ).toBe( 'all' );
        expect( moduleState( DATA, some ) ).toBe( 'some' );
        expect( moduleState( PRACTICE, some ) ).toBe( 'none' );
        expect( moduleState( MODULES[3], allTopics( MODULES ) ) ).toBe( 'none' );

        expect( [ ...toggleModule( DATA, some ) ] ).toEqual( [ uuid( 3 ), uuid( 4 ) ] );
        expect( [ ...toggleModule( DATA, new Set( [ uuid( 3 ), uuid( 4 ), uuid( 5 ) ] ) ) ] ).toEqual( [ uuid( 5 ) ] );
        expect( [ ...toggleTopic( uuid( 3 ), some ) ] ).toEqual( [] );
        expect( [ ...toggleTopic( uuid( 4 ), some ) ] ).toEqual( [ uuid( 3 ), uuid( 4 ) ] );
    } );

    it( 'counts distinct items', () => {
        expect( countItems( MODULES, allTopics( MODULES ) ) ).toBe( 6 );
        expect( countItems( MODULES, new Set( [ uuid( 1 ), uuid( 3 ) ] ) ) ).toBe( 3 );
        expect( countItems( MODULES, new Set() ) ).toBe( 0 );
    } );

    it( 'turns ticked topics into rules', () => {
        const skip = { scope: RuleScope.Item, scopeId: uuid( 11 ), mode: RuleMode.Exclude };
        const onlyItem = { scope: RuleScope.Item, scopeId: uuid( 12 ), mode: RuleMode.Include };
        const oldTopic = { scope: RuleScope.Topic, scopeId: uuid( 2 ), mode: RuleMode.Include };

        // Everything: no include rules; skipped items stay skipped, other old rules go.
        expect( rulesFor( MODULES, allTopics( MODULES ) ) ).toEqual( [] );
        expect( rulesFor( MODULES, allTopics( MODULES ), [ skip, onlyItem, oldTopic ] ) ).toEqual( [ skip ] );

        // A whole module, and single topics of another.
        expect( rulesFor( MODULES, new Set( [ uuid( 1 ), uuid( 2 ), uuid( 3 ) ] ), [ skip ] ) ).toEqual( [
            { scope: RuleScope.Module, scopeId: FOUNDATIONS.id, mode: RuleMode.Include },
            { scope: RuleScope.Topic, scopeId: uuid( 3 ), mode: RuleMode.Include },
            skip,
        ] );
    } );

    it( 'describes what is followed', () => {
        expect( describeParts( MODULES, allTopics( MODULES ) ) ).toBe( 'The whole path, including anything the author adds later.' );
        expect( describeParts( MODULES, new Set( [ uuid( 1 ), uuid( 2 ), uuid( 3 ), uuid( 4 ) ] ) ) )
            .toBe( '2 of 3 modules · 5 of 6 items. Practice is left out.' );
        expect( describeParts( MODULES, new Set( [ uuid( 1 ), uuid( 3 ), uuid( 5 ) ] ) ) )
            .toBe( '3 of 3 modules · 4 of 6 items. Some topics are left out.' );
        expect( describeParts( MODULES, new Set( [ uuid( 1 ) ] ) ) )
            .toBe( '1 of 3 modules · 2 of 6 items. Data and Practice are left out.' );

        const many = publishedPath( 'Many', [ 'A', 'B', 'C', 'D', 'E' ].map( ( title, i ) => ( {
            title,
            topics: [ { id: uuid( 50 + i ), title, items: [ { id: uuid( 60 + i ), title } ] } ],
        } ) ) ).modules;

        expect( describeParts( many, new Set( [ uuid( 50 ) ] ) ) ).toBe( '1 of 5 modules · 1 of 5 items. B, C and 2 more are left out.' );
    } );
} );

describe( 'preview', () => {
    const item = MODULES[0].topics[0].items[0];

    it( 'sums up an item', () => {
        expect( itemLine( item ) ).toBe( 'Problem' );
        expect( itemLine( { ...item, type: ItemType.Article, estimatedMinutes: 30 } ) ).toBe( 'Article · 30 min' );
        expect( itemLine( { ...item, type: ItemType.Book, details: { chapters: 'Ch. 1-3' }, isOptional: true } ) )
            .toBe( 'Book · Ch. 1-3 · Optional' );
        expect( itemLine( { ...item, difficulty: 'easy' as never, details: { chapters: '' } } ) ).toBe( 'Problem · Easy' );
    } );

    it( 'names where a path lives', () => {
        const official = publishedPath( 'P', [] );
        const workspace = { id: uuid( 1 ), name: 'Me', isPersonal: true };
        const me = { id: uuid( 7 ), firstName: 'Sam', lastName: 'Khan' };

        expect( sourceName( official, me.id ) ).toBe( 'Official catalog' );
        expect( sourceName( { ...official, organization: { ...workspace, name: 'Acme', isPersonal: false } }, me.id ) ).toBe( 'Acme' );
        expect( sourceName( { ...official, organization: workspace, createdBy: me }, me.id ) ).toBe( 'Your workspace' );
        expect( sourceName( { ...official, organization: workspace, createdBy: null }, me.id ) ).toBe( 'Community' );
        expect( formatMonth( '2026-10-05T10:00:00.000Z' ) ).toBe( 'Oct 2026' );
    } );

    it( 'explains why enrolling failed', () => {
        const api = ( status: number ) => new ApiError( status, 'failed' );

        expect( enrollError( new NetworkError() ) ).toMatch( /^Can't reach StudyLog/ );
        expect( enrollError( api( 409 ) ) ).toBe( 'You already follow this path. Reload the page to continue it.' );
        expect( enrollError( api( 404 ) ) ).toBe( 'This path isn\'t available any more.' );
        expect( enrollError( api( 500 ) ) ).toBe( 'Something went wrong, so you weren\'t enrolled. Please try again.' );
    } );
} );
