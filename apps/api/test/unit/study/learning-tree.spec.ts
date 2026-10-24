import { OrderParentType, ProgressStatus, RuleMode, RuleScope } from '@studylog/schemas';

import type { CatalogModuleNode } from '../../../src/catalog/catalog-tree.service.js';
import { applyOrders, orderChildren, selectContent, withProgress } from '../../../src/study/learning-tree.js';

// Only the fields these functions use; the rest of each node doesn't matter here.
const item = ( id: string, isOptional = false ) => ( { id, isOptional } );
const topic = ( id: string, items: ReturnType<typeof item>[] ) => ( { id, items } );
const module = ( id: string, topics: ReturnType<typeof topic>[] ) => ( { id, topics } );

// The example path from the design: Arrays (Hashing, Two Pointers) and Searching (Binary Search).
const catalog = [
    module( 'arrays', [
        topic( 'hashing', [ item( 'two-sum' ) ] ),
        topic( 'two-pointers', [ item( 'video' ), item( 'two-sum' ), item( 'two-sum-ii' ) ] ),
    ] ),
    module( 'searching', [ topic( 'binary-search', [ item( 'binary-search' ), item( 'clrs', true ) ] ) ] ),
] as unknown as CatalogModuleNode[];

/** "module/topic/item" for every selected item, to compare trees at a glance. */
const flatten = ( modules: CatalogModuleNode[] ) =>
    modules.flatMap( ( m ) => m.topics.flatMap( ( t ) => t.items.map( ( i ) => `${m.id}/${t.id}/${i.id}` ) ) );

const rule = ( scope: RuleScope, scopeId: string, mode: RuleMode ) => ( { scope, scopeId, mode } );

describe( 'selectContent', () => {
    it( 'selects the whole path without rules', () => {
        expect( flatten( selectContent( catalog, [] ) ) ).toHaveLength( 6 );
    } );

    it( 'with include rules, selects only what they cover (plus a more specific include elsewhere)', () => {
        const selected = selectContent( catalog, [
            rule( RuleScope.Module, 'arrays', RuleMode.Include ),
            rule( RuleScope.Topic, 'hashing', RuleMode.Exclude ),
            rule( RuleScope.Item, 'binary-search', RuleMode.Include ),
        ] );

        expect( flatten( selected ) ).toEqual( [
            'arrays/two-pointers/video',
            'arrays/two-pointers/two-sum',
            'arrays/two-pointers/two-sum-ii',
            'searching/binary-search/binary-search',
        ] );
    } );

    it( 'lets a single excluded item drop out while the rest stays', () => {
        expect( flatten( selectContent( catalog, [ rule( RuleScope.Item, 'clrs', RuleMode.Exclude ) ] ) ) )
            .not.toContain( 'searching/binary-search/clrs' );
    } );

    it( 'applies an item rule everywhere the item appears', () => {
        const selected = flatten( selectContent( catalog, [ rule( RuleScope.Item, 'two-sum', RuleMode.Exclude ) ] ) );

        expect( selected.filter( ( entry ) => entry.endsWith( '/two-sum' ) ) ).toEqual( [] );
        // Hashing only had Two Sum, so it disappears; Two Pointers keeps its other items.
        expect( selected.some( ( entry ) => entry.includes( '/hashing/' ) ) ).toBe( false );
        expect( selected ).toContain( 'arrays/two-pointers/video' );
    } );

    it( 'keeps an included topic or module that has no content yet', () => {
        const withEmpty = [ ...catalog, module( 'graphs', [] ), module( 'trees', [ topic( 'bst', [] ) ] ) ] as unknown as CatalogModuleNode[];

        expect( selectContent( withEmpty, [] ).map( ( m ) => m.id ) ).toEqual( [ 'arrays', 'searching', 'graphs', 'trees' ] );
        expect( selectContent( withEmpty, [ rule( RuleScope.Topic, 'bst', RuleMode.Include ) ] ).map( ( m ) => m.id ) )
            .toEqual( [ 'trees' ] );
    } );
} );

describe( 'orderChildren', () => {
    const children = [ { id: 'a' }, { id: 'b' }, { id: 'c' } ];

    it( 'uses the user order, then unlisted children in admin order, ignoring unknown ids', () => {
        expect( orderChildren( children, [ 'c', 'gone', 'a' ] ).map( ( c ) => c.id ) ).toEqual( [ 'c', 'a', 'b' ] );
    } );

    it( 'keeps the admin order without a user order', () => {
        expect( orderChildren( children, undefined ) ).toBe( children );
    } );
} );

describe( 'applyOrders', () => {
    it( 'reorders modules, topics and items independently', () => {
        const ordered = applyOrders( 'dsa', catalog, [
            { parentType: OrderParentType.Path, parentId: 'dsa', orderedIds: [ 'searching' ] },
            { parentType: OrderParentType.Topic, parentId: 'two-pointers', orderedIds: [ 'two-sum-ii', 'video' ] },
        ] );

        expect( flatten( ordered ) ).toEqual( [
            'searching/binary-search/binary-search',
            'searching/binary-search/clrs',
            'arrays/hashing/two-sum',
            'arrays/two-pointers/two-sum-ii',
            'arrays/two-pointers/video',
            'arrays/two-pointers/two-sum',
        ] );
    } );
} );

describe( 'withProgress', () => {
    const progress = new Map( [
        [ 'two-sum', ProgressStatus.Done ],
        [ 'video', ProgressStatus.InProgress ],
        [ 'binary-search', ProgressStatus.Revise ],
        [ 'clrs', ProgressStatus.Done ],
    ] );
    const result = withProgress( catalog, progress );

    it( 'counts required items once each, with revise as completed and optional items left out', () => {
        // Required: two-sum, video, two-sum-ii, binary-search. Completed: two-sum, binary-search.
        expect( result.progress ).toEqual( { completed: 2, total: 4 } );
        expect( result.modules[0]?.progress ).toEqual( { completed: 1, total: 3 } );
        expect( result.modules[1]?.progress ).toEqual( { completed: 1, total: 1 } );
        expect( result.modules[0]?.topics[1]?.progress ).toEqual( { completed: 1, total: 3 } );
    } );

    it( 'marks each item with its status, not_started when there is none', () => {
        expect( result.modules[0]?.topics[1]?.items.map( ( i ) => i.progress ) )
            .toEqual( [ ProgressStatus.InProgress, ProgressStatus.Done, ProgressStatus.NotStarted ] );
    } );
} );
