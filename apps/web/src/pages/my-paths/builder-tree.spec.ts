import { Difficulty, ItemType } from '@studylog/schemas/enums';

import { pathTree, uuid } from '../../test/fixtures.ts';
import { itemMeta, moved, resolveSelection } from './builder-tree.ts';

const PATH = pathTree( 'Interview Prep', [
    { title: 'Basics', topics: [] },
    { title: 'Patterns', topics: [ { title: 'Must Do', items: [] }, { title: 'Nice to Have', items: [] } ] },
] );
const [ BASICS, PATTERNS ] = PATH.modules;

describe( 'resolveSelection', () => {
    it( 'finds the chosen module or topic, or the path', () => {
        expect( resolveSelection( PATH, { kind: 'module', id: BASICS.id } ) ).toEqual( { kind: 'module', module: BASICS } );
        expect( resolveSelection( PATH, { kind: 'topic', id: PATTERNS.topics[1].id } ) )
            .toEqual( { kind: 'topic', topic: PATTERNS.topics[1], module: PATTERNS } );
        expect( resolveSelection( PATH, { kind: 'path' } ) ).toEqual( { kind: 'path' } );
    } );

    it( 'without a choice, or when it\'s gone, opens the first topic, else the first module, else the path', () => {
        const first = { kind: 'topic', topic: PATTERNS.topics[0], module: PATTERNS };

        expect( resolveSelection( PATH, undefined ) ).toEqual( first );
        expect( resolveSelection( PATH, { kind: 'topic', id: uuid( 1 ) } ) ).toEqual( first );
        expect( resolveSelection( { ...PATH, modules: [ BASICS ] }, undefined ) ).toEqual( { kind: 'module', module: BASICS } );
        expect( resolveSelection( { ...PATH, modules: [] }, { kind: 'module', id: BASICS.id } ) ).toEqual( { kind: 'path' } );
    } );
} );

describe( 'moved', () => {
    it( 'swaps an id with its neighbour', () => {
        expect( moved( [ 'a', 'b', 'c' ], 'b', -1 ) ).toEqual( [ 'b', 'a', 'c' ] );
        expect( moved( [ 'a', 'b', 'c' ], 'b', 1 ) ).toEqual( [ 'a', 'c', 'b' ] );
    } );
} );

describe( 'itemMeta', () => {
    it( 'says what an item is and where it comes from', () => {
        expect( itemMeta( { type: ItemType.Problem, difficulty: Difficulty.Easy, organizationId: null } ) )
            .toBe( 'Problem · Easy · from the catalog' );
        expect( itemMeta( { type: ItemType.Note, difficulty: null, organizationId: uuid( 4 ) } ) ).toBe( 'Note · your item' );
        expect( itemMeta( { type: ItemType.Video, difficulty: null, organizationId: null }, '' ) ).toBe( 'Video' );
    } );
} );
