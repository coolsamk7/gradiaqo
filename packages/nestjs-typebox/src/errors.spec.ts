import { BadRequestException } from '@nestjs/common';
import type { TSchema } from 'typebox';
import Type from 'typebox';
import type { TLocalizedValidationError } from 'typebox/error';
import { describe, expect, it } from 'vitest';

import { toIssues, toStandardIssues } from './errors.js';
import { typeboxExceptionFactory } from './exceptions.js';

/** A TypeBox validation error with only the fields toIssues reads. */
const error = ( fields: Partial<TLocalizedValidationError> ) =>
    ( { instancePath: '', schemaPath: '#', params: {}, message: 'invalid', ...fields } ) as TLocalizedValidationError;

describe( 'toIssues edge cases', () => {
    it( 'ignores a required error that names no properties', () => {
        expect( toIssues( Type.Object( {} ), [ error( { keyword: 'required' } ) ] ) ).toEqual( [] );
    } );

    it( 'reports a false schema (not additionalProperties) with its own errorMessage, or TypeBox\'s', () => {
        const schema = { type: 'object', properties: { x: { errorMessage: 'x is not accepted here' }, y: {} } } as unknown as TSchema;

        expect( toIssues( schema, [
            error( { keyword: 'boolean', schemaPath: '#/properties/x', instancePath: '/x' } ),
            error( { keyword: 'boolean', schemaPath: '#/properties/y', instancePath: '/y', message: 'must not be present' } ),
        ] ) ).toEqual( [
            { path: '/x', message: 'x is not accepted here', keyword: 'boolean' },
            { path: '/y', message: 'must not be present', keyword: 'boolean' },
        ] );
    } );

    it( 'lists the values of a oneOf of literals, and falls back to TypeBox\'s message otherwise', () => {
        const schema = { oneOf: [ { const: 'S' }, { const: 'M' } ] } as unknown as TSchema;

        expect( toIssues( schema, [ error( { keyword: 'oneOf' } ) ] ) )
            .toEqual( [ { path: '', message: 'must be one of \'S\', \'M\'', keyword: 'oneOf' } ] );
        expect( toIssues( Type.String(), [ error( { keyword: 'anyOf', schemaPath: '#/nowhere', message: 'no match' } ) ] ) )
            .toEqual( [ { path: '', message: 'no match', keyword: 'anyOf' } ] );
    } );

    it( 'finds no custom message when the schema path runs past a leaf', () => {
        expect( toIssues( Type.String(), [ error( { keyword: 'type', schemaPath: '#/type/deeper', message: 'must be string' } ) ] ) )
            .toEqual( [ { path: '', message: 'must be string', keyword: 'type' } ] );
    } );
} );

describe( 'Standard Schema issues', () => {
    it( 'turn JSON pointers into path arrays (numbers for indexes), and the root into no path', () => {
        expect( toStandardIssues( [
            { path: '/items/0/a~1b', message: 'bad', keyword: 'type' },
            { path: '', message: 'root', keyword: 'type' },
        ] ) ).toEqual( [
            { message: 'bad', path: [ 'items', 0, 'a/b' ] },
            { message: 'root', path: undefined },
        ] );
    } );

    it( 'typeboxExceptionFactory formats Nest\'s standard-schema issues like the rest of the library', () => {
        const exception = typeboxExceptionFactory( [
            { message: 'is required', path: [ 'owner', { key: 'name' }, 0 ] },
            { message: 'bad body' },
        ] );

        expect( exception ).toBeInstanceOf( BadRequestException );
        expect( exception.getResponse() ).toEqual( {
            statusCode: 400,
            message: 'Validation failed',
            errors: [ { path: '/owner/name/0', message: 'is required' }, { path: '', message: 'bad body' } ],
        } );
    } );
} );
