import Type from 'typebox';
import { describe, expect, it } from 'vitest';

import { TypeboxResponseValidationException, TypeboxValidationException } from './exceptions.js';
import { typebox } from './schema.js';
import { IsoDate, LiteralUnion, Nullable, PartialSome, UnionPartialSome } from './util.js';

const Signup = Type.Object(
    {
        email: Type.String( { format: 'email', errorMessage: 'Enter a valid email' } ),
        name: Type.String( { minLength: 1 } ),
        role: Type.String( { default: 'member' } ),
    },
    { additionalProperties: false },
);

describe( 'typebox() — requests', () => {
    it( 'returns the value, with defaults applied, without mutating the input', () => {
        const input = { email: 'a@b.co', name: 'Sam' };
        const result = typebox( Signup ).safeParse( input );

        expect( result ).toEqual( { value: { email: 'a@b.co', name: 'Sam', role: 'member' } } );
        expect( input ).toEqual( { email: 'a@b.co', name: 'Sam' } );
    } );

    it( 'reports one issue per problem, using errorMessage and per-property required errors', () => {
        const result = typebox( Signup ).safeParse( { email: 'nope' } );

        expect( result.issues ).toEqual( [
            { path: '/name', message: 'is required', keyword: 'required' },
            { path: '/email', message: 'Enter a valid email', keyword: 'format' },
        ] );
    } );

    it( 'says "is required" for a missing property, even if the property has its own errorMessage', () => {
        const result = typebox( Signup ).safeParse( { name: 'Sam' } );

        expect( result.issues ).toEqual( [ { path: '/email', message: 'is required', keyword: 'required' } ] );
    } );

    it( 'rejects unknown properties by default when the schema forbids them', () => {
        const result = typebox( Signup ).safeParse( { email: 'a@b.co', name: 'Sam', isAdmin: true } );

        expect( result.issues ).toEqual( [ { path: '/isAdmin', message: 'is not allowed', keyword: 'additionalProperties' } ] );
    } );

    it( 'strips unknown properties when asked', () => {
        const schema = typebox( Type.Object( { name: Type.String() } ), { stripUnknown: true } );

        expect( schema.parse( { name: 'Sam', isAdmin: true } ) ).toEqual( { name: 'Sam' } );
    } );

    it( 'coerces strings for query / path params when asked', () => {
        const schema = typebox( Type.Object( { limit: Type.Integer(), all: Type.Boolean() } ), { coerce: true } );

        expect( schema.parse( { limit: '5', all: 'true' } ) ).toEqual( { limit: 5, all: true } );
        expect( typebox( Type.Integer() ).safeParse( '5' ).issues ).toHaveLength( 1 );
    } );

    it( 'decodes codecs (ISO string → Date) and rejects invalid wire values', () => {
        const schema = typebox( Type.Object( { at: IsoDate() } ) );
        const value = schema.parse( { at: '2026-01-02T03:04:05.000Z' } );

        expect( value.at ).toBeInstanceOf( Date );
        expect( value.at.toISOString() ).toBe( '2026-01-02T03:04:05.000Z' );
        expect( schema.safeParse( { at: 'yesterday' } ).issues?.[0] ).toMatchObject( { path: '/at', keyword: 'format' } );
    } );

    it( 'does not repeat errors for every branch of a union', () => {
        const schema = typebox( Type.Object( { id: Type.Union( [ Type.Integer(), Type.String( { format: 'uuid' } ) ] ) } ) );

        expect( schema.safeParse( { id: true } ).issues ).toEqual( [
            { path: '/id', message: 'must match a schema in anyOf', keyword: 'anyOf' },
        ] );
    } );

    it( 'throws TypeboxValidationException (400) with the issues', () => {
        expect.assertions( 3 );
        try {
            typebox( Signup, { location: 'query' } ).parse( {} );
        } catch ( error ) {
            expect( error ).toBeInstanceOf( TypeboxValidationException );
            expect( ( error as TypeboxValidationException ).getStatus() ).toBe( 400 );
            expect( ( error as TypeboxValidationException ).getResponse() ).toMatchObject( {
                message: 'Validation failed (query)',
                errors: expect.arrayContaining( [ expect.objectContaining( { path: '/email' } ) ] ),
            } );
        }
    } );
} );

describe( 'typebox() — responses', () => {
    const User = Type.Object( { id: Type.String(), createdAt: IsoDate() } );

    it( 'encodes Dates and strips properties that must not leak', () => {
        const schema = typebox( User, { direction: 'response' } );
        const createdAt = new Date( '2026-01-02T03:04:05.000Z' );
        const entity = { id: 'u1', createdAt, passwordHash: '$argon2id$...' };

        expect( schema.parse( entity ) ).toEqual( { id: 'u1', createdAt: '2026-01-02T03:04:05.000Z' } );
        expect( entity.passwordHash ).toBeDefined(); // the handler's object is untouched
    } );

    it( 'throws a 500 when the handler returns the wrong shape', () => {
        expect( () => typebox( User, { direction: 'response' } ).parse( { id: 1 } ) ).toThrow( TypeboxResponseValidationException );
    } );
} );

describe( 'typebox() — Standard Schema', () => {
    it( 'implements ~standard.validate with path arrays', async () => {
        const schema = typebox( Type.Object( { items: Type.Array( Type.Object( { qty: Type.Integer() } ) ) } ) );
        const ok = await schema['~standard'].validate( { items: [ { qty: 1 } ] } );
        const bad = await schema['~standard'].validate( { items: [ { qty: 'x' } ] } );

        expect( schema['~standard'].vendor ).toBe( 'typebox' );
        expect( ok ).toEqual( { value: { items: [ { qty: 1 } ] } } );
        expect( bad.issues?.[0]?.path ).toEqual( [ 'items', 0, 'qty' ] );
    } );

    it( 'emits named schemas as $ref + $defs, and plain JSON Schema without TypeBox extras', () => {
        const schema = typebox(
            Type.Object( { email: Type.String( { errorMessage: 'bad' } ), errorMessage: Type.String() } ),
            { name: 'Contact' },
        );
        const json = schema['~standard'].jsonSchema.input( { target: 'openapi-3.0' } ) as {
            $ref: string;
            $defs: Record<string, { properties: Record<string, object> }>;
        };

        expect( json.$ref ).toBe( '#/$defs/Contact' );
        expect( json.$defs.Contact?.properties.email ).toEqual( { type: 'string' } );
        // A *property* named errorMessage is kept; only the string keyword is removed.
        expect( json.$defs.Contact?.properties.errorMessage ).toEqual( { type: 'string' } );
        expect( typebox( Type.String() ).toJsonSchema() ).toEqual( { type: 'string' } );
    } );
} );

describe( 'utilities (ported to TypeBox 1.x)', () => {
    const Cat = Type.Object( { name: Type.String(), age: Type.Integer() } );

    it( 'PartialSome makes only the given keys optional', () => {
        const schema = typebox( PartialSome( Cat, [ 'age' ] ) );

        expect( schema.safeParse( { name: 'Tom' } ).issues ).toBeUndefined();
        expect( schema.safeParse( { age: 3 } ).issues ).toHaveLength( 1 );
    } );

    it( 'UnionPartialSome applies PartialSome to each union member', () => {
        const Dog = Type.Object( { name: Type.String(), breed: Type.String() } );
        const schema = typebox( UnionPartialSome( Type.Union( [ Cat, Dog ] ), [ 'name' ] ) );

        expect( schema.safeParse( { age: 3 } ).issues ).toBeUndefined();
        expect( schema.safeParse( { breed: 'pug' } ).issues ).toBeUndefined();
    } );

    it( 'LiteralUnion and Nullable', () => {
        const schema = typebox( Type.Object( { size: LiteralUnion( [ 'S', 'M' ] ), note: Nullable( Type.String() ) } ) );

        expect( schema.safeParse( { size: 'M', note: null } ).issues ).toBeUndefined();
        expect( schema.safeParse( { size: 'M' } ).issues ).toBeUndefined();
        expect( schema.safeParse( { size: 'XL' } ).issues ).toEqual( [
            { path: '/size', message: 'must be one of \'S\', \'M\'', keyword: 'anyOf' },
        ] );
    } );
} );
