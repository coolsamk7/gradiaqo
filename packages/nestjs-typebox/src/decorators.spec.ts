import 'reflect-metadata';

import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import Type from 'typebox';
import { describe, expect, it } from 'vitest';

import { configureNestJsTypebox } from './configure.js';
import { buildSchemaValidator, HttpEndpoint, isSchemaValidator, TypeboxResponse } from './decorators.js';
import { TypeboxResponseInterceptor } from './interceptors.js';
import { TYPEBOX_RESPONSE_SCHEMA } from './interceptors.js';
import { typebox } from './schema.js';

const Cat = Type.Object( { name: Type.String() } );

/** Applies a method decorator to a throwaway handler and returns the handler. */
function decorate( decorator: MethodDecorator ) {
    class Target {
        handler() {
            return this;
        }
    }

    const descriptor = Object.getOwnPropertyDescriptor( Target.prototype, 'handler' )!;

    decorator( Target.prototype, 'handler', descriptor );

    return descriptor.value as () => unknown;
}

describe( 'TypeboxResponse', () => {
    it( 'uses a typebox() schema\'s name, or the name given, and stores the response schema', () => {
        const named = decorate( TypeboxResponse( typebox( Cat, { name: 'Cat' } ) ) );
        const renamed = decorate( TypeboxResponse( Cat, { name: 'Kitten', status: 201, description: 'Created', example: { name: 'Tom' } } ) );

        expect( ( Reflect.getMetadata( TYPEBOX_RESPONSE_SCHEMA, named ) as { name: string } ).name ).toBe( 'Cat' );
        expect( ( Reflect.getMetadata( TYPEBOX_RESPONSE_SCHEMA, renamed ) as { name: string } ).name ).toBe( 'Kitten' );
    } );
} );

describe( 'TypeboxResponseInterceptor', () => {
    const next = ( value: unknown ): CallHandler => ( { handle: () => of( value ) } );
    const contextFor = ( handler: () => unknown ) => ( { getHandler: () => handler } ) as unknown as ExecutionContext;
    const interceptor = new TypeboxResponseInterceptor( new Reflector() );

    it( 'encodes and strips the result of a route with a response schema', async () => {
        const handler = decorate( TypeboxResponse( Cat ) );

        await expect( lastValueFrom( interceptor.intercept( contextFor( handler ), next( { name: 'Tom', secret: 1 } ) ) ) )
            .resolves.toEqual( { name: 'Tom' } );
    } );

    it( 'passes results through untouched on routes without one', async () => {
        const handler = () => undefined;

        await expect( lastValueFrom( interceptor.intercept( contextFor( handler ), next( { anything: true } ) ) ) )
            .resolves.toEqual( { anything: true } );
    } );
} );

describe( 'v4 compatibility', () => {
    it( 'isSchemaValidator recognizes typebox() schemas and objects with a validate function', () => {
        expect( isSchemaValidator( typebox( Cat ) ) ).toBe( true );
        expect( isSchemaValidator( { validate: () => true } ) ).toBe( true );
        expect( isSchemaValidator( { validate: 'no' } ) ).toBe( false );
        expect( isSchemaValidator( null ) ).toBe( false );
        expect( isSchemaValidator( 'Cat' ) ).toBe( false );
    } );

    describe( 'buildSchemaValidator', () => {
        it( 'rejects incomplete configs', () => {
            expect( () => buildSchemaValidator( { name: 'x', schema: Cat } ) ).toThrow( 'missing "type"' );
            expect( () => buildSchemaValidator( { type: 'body', schema: Cat } as never ) ).toThrow( 'missing name' );
            expect( () => buildSchemaValidator( { type: 'body', name: 'x', schema: 'Cat' } as never ) ).toThrow( 'expects a TypeBox schema' );
        } );

        it( 'checks and validates request values; optional ones may be missing', () => {
            const body = buildSchemaValidator( { type: 'body', name: 'CatBody', schema: Cat } );
            const optional = buildSchemaValidator( { type: 'query', name: 'limit', schema: Type.Integer(), coerceTypes: true, required: false } );

            expect( body.check( { name: 'Tom' } ) ).toBe( true );
            expect( body.check( { name: 1 } ) ).toBe( false );
            expect( body.validate( { name: 'Tom' } ) ).toEqual( { name: 'Tom' } );
            expect( () => body.validate( undefined ) ).toThrow();
            expect( optional.validate( undefined ) ).toBeUndefined();
            expect( optional.validate( '5' ) ).toBe( 5 );
        } );

        it( 'validates responses, stripping unknown properties', () => {
            const response = buildSchemaValidator( { type: 'response', name: 'CatResponse', schema: Cat } );

            expect( response.validate( { name: 'Tom', secret: 1 } ) ).toEqual( { name: 'Tom' } );
        } );
    } );

    describe( 'HttpEndpoint', () => {
        it( 'needs a request validator for every path parameter', () => {
            expect( () => HttpEndpoint( { method: 'GET', path: 'cats/:id' } ) ).toThrow( 'Path param "id" is missing a request validator' );
        } );

        it( 'rejects an optional validator for a required path parameter', () => {
            expect( () => HttpEndpoint( {
                method: 'GET',
                path: 'cats/:id',
                validate: { request: [ { type: 'param', name: 'id', required: false } ] },
            } ) ).toThrow( 'Optional path param "id" is required in validator' );
        } );

        it( 'rejects a param validator for a parameter the path doesn\'t have', () => {
            expect( () => HttpEndpoint( {
                method: 'GET',
                path: 'cats/:id',
                validate: { request: [ { type: 'param', name: 'id' }, { type: 'param', name: 'ownerId' } ] },
            } ) ).toThrow( 'non-existent path parameter "ownerId"' );
        } );

        it( 'accepts an optional path parameter, a response given as config, and routes without a path or validation', () => {
            expect( () => decorate( HttpEndpoint( {
                method: 'GET',
                path: 'cats/:id?',
                validate: {
                    request: [ { type: 'param', name: 'id', required: false } ],
                    response: { schema: Cat, description: 'A cat' },
                },
            } ) ) ).not.toThrow();
            expect( () => decorate( HttpEndpoint( { method: 'DELETE' } ) ) ).not.toThrow();
        } );
    } );

    it( 'configureNestJsTypebox is a no-op kept for v4 code', () => {
        expect( configureNestJsTypebox( {} ) ).toBeUndefined();
    } );
} );
