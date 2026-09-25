import Type from 'typebox';
import { Compile } from 'typebox/compile';
import { describe, expect, it } from 'vitest';

import { capitalize, DistOmit, DistPick, isObj, LiteralUnion, MaybeArray, Nullable, PartialSome, UnionPartialSome } from './util.js';

const Cat = Type.Object( { name: Type.String(), age: Type.Integer() } );
const check = ( schema: Parameters<typeof Compile>[0], value: unknown ) => Compile( schema ).Check( value );

describe( 'schema helpers', () => {
    it( 'capitalize and isObj', () => {
        expect( capitalize( 'cat' ) ).toBe( 'Cat' );
        expect( isObj( {} ) ).toBe( true );
        expect( isObj( null ) ).toBe( false );
        expect( isObj( 'x' ) ).toBe( false );
    } );

    it( 'LiteralUnion accepts only the listed values', () => {
        expect( check( LiteralUnion( [ 'a', 'b' ] ), 'a' ) ).toBe( true );
        expect( check( LiteralUnion( [ 'a', 'b' ] ), 'c' ) ).toBe( false );
    } );

    it( 'PartialSome makes only the given keys optional', () => {
        const schema = PartialSome( Cat, [ 'age' ] );

        expect( check( schema, { name: 'Tom' } ) ).toBe( true );
        expect( check( schema, { age: 1 } ) ).toBe( false );
    } );

    it( 'DistOmit and DistPick', () => {
        expect( check( DistOmit( Cat, [ 'age' ] ), { name: 'Tom' } ) ).toBe( true );
        expect( check( DistPick( Cat, [ 'age' ] ), { age: 1 } ) ).toBe( true );
    } );

    it( 'MaybeArray accepts one value or a list', () => {
        expect( check( MaybeArray( Type.String() ), 'a' ) ).toBe( true );
        expect( check( MaybeArray( Type.String() ), [ 'a', 'b' ] ) ).toBe( true );
        expect( check( MaybeArray( Type.String() ), 1 ) ).toBe( false );
    } );

    it( 'Nullable accepts the value or null, and is optional in an object', () => {
        const schema = Type.Object( { note: Nullable( Type.String() ) } );

        expect( check( schema, { note: null } ) ).toBe( true );
        expect( check( schema, {} ) ).toBe( true );
    } );

    it( 'UnionPartialSome makes the keys optional on every member', () => {
        const schema = UnionPartialSome( Type.Union( [ Cat, Type.Object( { name: Type.String(), wings: Type.Integer() } ) ] ), [ 'name' ] );

        expect( check( schema, { age: 1 } ) ).toBe( true );
        expect( check( schema, { wings: 2 } ) ).toBe( true );
    } );
} );
