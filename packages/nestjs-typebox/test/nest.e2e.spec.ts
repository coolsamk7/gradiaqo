import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Static, StaticDecode } from 'typebox';
import Type from 'typebox';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HttpEndpoint, IsoDate, typebox, TypeboxResponse, TypeboxValidationPipe } from '../src/index.js';

// ---------- Schemas ----------

const CreateCatSchema = Type.Object(
    { name: Type.String( { minLength: 1 } ), age: Type.Integer( { minimum: 0 } ) },
    { additionalProperties: false },
);
const CatSchema = Type.Object( { id: Type.String(), name: Type.String(), bornAt: IsoDate() } );

const CreateCat = typebox( CreateCatSchema, { name: 'CreateCat' } );
const CatId = typebox( Type.String( { format: 'uuid' } ) );
const Search = typebox( Type.Object( { limit: Type.Integer( { minimum: 1, default: 10 } ) } ), { coerce: true } );

const BORN_AT = new Date( '2020-01-02T03:04:05.000Z' );
const CAT_ID = '6c4d2a3e-9a1b-4c5d-8e7f-0a1b2c3d4e5f';

// ---------- Native Nest 12 API: @Body( { schema } ) + global TypeboxValidationPipe ----------

@Controller( 'native' )
class NativeController {
    @Post( 'cats' )
    @TypeboxResponse( CatSchema, { status: 201, name: 'Cat' } )
    create( @Body( { schema: CreateCat } ) body: Static<typeof CreateCatSchema> ) {
        // The extra `secret` field must never reach the client.
        return { id: 'c1', name: body.name, bornAt: BORN_AT, secret: 'hunter2' };
    }

    @Get( 'cats/:id' )
    @TypeboxResponse( CatSchema, { name: 'Cat' } )
    findOne( @Param( 'id', { schema: CatId } ) id: string ) {
        return { id, name: 'Tom', bornAt: BORN_AT };
    }

    @Get( 'search' )
    search( @Query( { schema: Search } ) query: StaticDecode<typeof Search.schema> ) {
        return { limit: query.limit, type: typeof query.limit };
    }

    @Get( 'broken' )
    @TypeboxResponse( CatSchema )
    broken() {
        return { id: 42 };
    }
}

// ---------- nestjs-typebox v4 compatible API ----------

@Controller( 'compat' )
class CompatController {
    @HttpEndpoint( {
        method: 'POST',
        path: 'owners/:ownerId/cats',
        responseCode: 201,
        summary: 'Create a cat for an owner',
        validate: {
            request: [
                { type: 'param', name: 'ownerId', schema: Type.Integer( { minimum: 1 } ) },
                { type: 'query', name: 'dryRun', schema: Type.Boolean(), required: false },
                { type: 'body', schema: CreateCatSchema },
            ],
            response: CatSchema,
        },
    } )
    create( ownerId: number, dryRun: boolean | undefined, body: Static<typeof CreateCatSchema> ) {
        return { id: `${ownerId}-${dryRun === true ? 'dry' : 'real'}`, name: body.name, bornAt: BORN_AT, secret: 'x' };
    }

    // A codec in the request: must be decoded exactly once, even with the global pipe installed.
    @HttpEndpoint( {
        method: 'POST',
        path: 'birthdays',
        validate: { request: [ { type: 'body', schema: Type.Object( { at: IsoDate() } ) } ] },
    } )
    birthday( body: { at: Date } ) {
        return { isDate: body.at instanceof Date, iso: body.at.toISOString() };
    }
}

describe( 'NestJS 12 integration', () => {
    let app: INestApplication;
    let document: OpenAPIObject;

    beforeAll( async () => {
        const moduleRef = await Test.createTestingModule( {
            controllers: [ NativeController, CompatController ],
        } ).compile();

        app = moduleRef.createNestApplication( { logger: false } );
        app.useGlobalPipes( new TypeboxValidationPipe() );
        await app.init();
        document = SwaggerModule.createDocument( app, new DocumentBuilder().build() );
    } );

    afterAll( () => app.close() );

    describe( 'native API', () => {
        it( 'validates the body and shapes the response (Date encoded, unknown fields stripped)', async () => {
            const res = await request( app.getHttpServer() ).post( '/native/cats' ).send( { name: 'Tom', age: 3 } );

            expect( res.status ).toBe( 201 );
            expect( res.body ).toEqual( { id: 'c1', name: 'Tom', bornAt: BORN_AT.toISOString() } );
        } );

        it( 'rejects an invalid body with a 400 listing every problem', async () => {
            const res = await request( app.getHttpServer() ).post( '/native/cats' ).send( { name: '', isAdmin: true } );

            expect( res.status ).toBe( 400 );
            expect( res.body ).toMatchObject( { statusCode: 400, message: 'Validation failed (body)' } );
            expect( res.body.errors ).toEqual(
                expect.arrayContaining( [
                    expect.objectContaining( { path: '/age', keyword: 'required' } ),
                    expect.objectContaining( { path: '/name', keyword: 'minLength' } ),
                    expect.objectContaining( { path: '/isAdmin', message: 'is not allowed' } ),
                ] ),
            );
        } );

        it( 'validates path params', async () => {
            expect( ( await request( app.getHttpServer() ).get( `/native/cats/${CAT_ID}` ) ).status ).toBe( 200 );

            const bad = await request( app.getHttpServer() ).get( '/native/cats/not-a-uuid' );

            expect( bad.status ).toBe( 400 );
            expect( bad.body.message ).toBe( 'Validation failed (param)' );
        } );

        it( 'coerces query strings and applies defaults', async () => {
            expect( ( await request( app.getHttpServer() ).get( '/native/search?limit=5' ) ).body ).toEqual( { limit: 5, type: 'number' } );
            expect( ( await request( app.getHttpServer() ).get( '/native/search' ) ).body ).toEqual( { limit: 10, type: 'number' } );
            expect( ( await request( app.getHttpServer() ).get( '/native/search?limit=0' ) ).status ).toBe( 400 );
        } );

        it( 'returns 500 (not the bad data) when a handler breaks its response contract', async () => {
            const res = await request( app.getHttpServer() ).get( '/native/broken' );

            expect( res.status ).toBe( 500 );
            expect( JSON.stringify( res.body ) ).not.toContain( '42' );
        } );
    } );

    describe( 'v4-compatible @HttpEndpoint / @Validate', () => {
        it( 'coerces params and query, validates the body, shapes the response', async () => {
            const res = await request( app.getHttpServer() ).post( '/compat/owners/7/cats?dryRun=true' ).send( { name: 'Tom', age: 3 } );

            expect( res.status ).toBe( 201 );
            expect( res.body ).toEqual( { id: '7-dry', name: 'Tom', bornAt: BORN_AT.toISOString() } );
        } );

        it( 'treats a missing optional query as undefined', async () => {
            const res = await request( app.getHttpServer() ).post( '/compat/owners/7/cats' ).send( { name: 'Tom', age: 3 } );

            expect( res.body.id ).toBe( '7-real' );
        } );

        it( 'rejects bad params and bodies', async () => {
            const badParam = await request( app.getHttpServer() ).post( '/compat/owners/0/cats' ).send( { name: 'Tom', age: 3 } );
            const badBody = await request( app.getHttpServer() ).post( '/compat/owners/7/cats' ).send( { name: 'Tom' } );

            expect( [ badParam.status, badParam.body.message ] ).toEqual( [ 400, 'Validation failed (param)' ] );
            expect( [ badBody.status, badBody.body.message ] ).toEqual( [ 400, 'Validation failed (body)' ] );
        } );

        it( 'decodes request codecs once, even alongside the global TypeboxValidationPipe', async () => {
            const res = await request( app.getHttpServer() ).post( '/compat/birthdays' ).send( { at: BORN_AT.toISOString() } );

            expect( res.status ).toBe( 200 );
            expect( res.body ).toEqual( { isDate: true, iso: BORN_AT.toISOString() } );
        } );

        it( 'still throws the v4 errors for misconfigured path params', () => {
            expect( () =>
                HttpEndpoint( { method: 'GET', path: 'cats/:id', validate: { request: [] } } ) ).toThrow( 'Path param "id" is missing a request validator.' );
        } );
    } );

    describe( 'OpenAPI document', () => {
        const schemaRef = ( content: unknown ) =>
            ( content as { 'application/json': { schema: { $ref?: string } } } )['application/json'].schema.$ref;

        it( 'registers named models as components', () => {
            const schemas = document.components?.schemas ?? {};

            expect( Object.keys( schemas ) ).toEqual( expect.arrayContaining( [ 'CreateCat', 'Cat', 'CreateBody', 'CreateResponse' ] ) );
            expect( schemas.CreateCat ).toMatchObject( {
                type: 'object',
                required: [ 'name', 'age' ],
                properties: { name: { type: 'string', minLength: 1 }, age: { type: 'integer', minimum: 0 } },
            } );
            expect( schemas.Cat ).toMatchObject( { properties: { bornAt: { type: 'string', format: 'date-time' } } } );
        } );

        it( 'documents request bodies, params, queries and responses', () => {
            const createCat = document.paths['/native/cats']?.post;
            const findOne = document.paths['/native/cats/{id}']?.get;
            const compat = document.paths['/compat/owners/{ownerId}/cats']?.post;

            expect( schemaRef( ( createCat?.requestBody as { content: unknown } ).content ) ).toBe( '#/components/schemas/CreateCat' );
            expect( schemaRef( ( createCat?.responses['201'] as { content: unknown } ).content ) ).toBe( '#/components/schemas/Cat' );
            expect( findOne?.parameters ).toEqual(
                expect.arrayContaining( [ expect.objectContaining( { name: 'id', in: 'path', schema: { type: 'string', format: 'uuid' } } ) ] ),
            );
            expect( compat?.summary ).toBe( 'Create a cat for an owner' );
            expect( compat?.parameters ).toEqual(
                expect.arrayContaining( [
                    expect.objectContaining( { name: 'ownerId', in: 'path', required: true } ),
                    expect.objectContaining( { name: 'dryRun', in: 'query', required: false } ),
                ] ),
            );
            expect( schemaRef( ( compat?.responses['201'] as { content: unknown } ).content ) ).toBe( '#/components/schemas/CreateResponse' );
        } );
    } );
} );
