import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module.js';

// Needs the database from `yarn db:up` and apps/api/.env.
describe( 'Health (e2e)', () => {
    let app: INestApplication<App>;

    beforeEach( async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule( {
            imports: [ AppModule ],
        } ).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    } );

    it( 'GET /health reports the API and database as up', () => {
        return request( app.getHttpServer() ).get( '/health' ).expect( 200 )
            .expect( { status: 'ok', database: 'up' } );
    } );

    afterEach( async () => {
        await app.close();
    } );
} );
