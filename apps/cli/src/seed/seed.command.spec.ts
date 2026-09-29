import { stripVTControlCharacters } from 'node:util';

import type { ConfigService } from '@nestjs/config';
import { User } from '@studylog/database';
import * as argon2 from 'argon2';
import type { DataSource, EntityManager } from 'typeorm';

import type { DatabaseService } from '../database/database.service.js';
import { SeedCommand } from './seed.command.js';
import { SEED_PASSWORD } from './seed-content.js';

vi.mock( 'argon2', () => ( { hash: vi.fn( () => Promise.resolve( 'hashed' ) ) } ) );

/** A DatabaseService whose transaction records what it's asked to do. */
function databaseWith( { seeded = false, insertError = null as Error | null } = {} ) {
    const manager = {
        query: vi.fn(),
        existsBy: vi.fn( () => Promise.resolve( seeded ) ),
        insert: vi.fn( () => ( insertError ? Promise.reject( insertError ) : Promise.resolve() ) ),
    };
    const dataSource = {
        entityMetadatas: [ { tableName: 'users' }, { tableName: 'items' } ],
        transaction: vi.fn( ( work: ( m: EntityManager ) => unknown ) =>
            Promise.resolve( work( manager as unknown as EntityManager ) ) ),
    };
    const database = {
        withDataSource: vi.fn( ( work: ( ds: DataSource ) => unknown ) =>
            Promise.resolve( work( dataSource as unknown as DataSource ) ) ),
    };

    return { database: database as unknown as DatabaseService, withDataSource: database.withDataSource, manager };
}

const config = ( nodeEnv?: string ) => ( { get: vi.fn( () => nodeEnv ) } ) as unknown as ConfigService;

describe( 'db:seed', () => {
    let stdout: string[];
    let stderr: string[];

    beforeEach( () => {
        stdout = [];
        stderr = [];
        vi.spyOn( process.stdout, 'write' ).mockImplementation( ( chunk ) => stdout.push( String( chunk ) ) > 0 );
        vi.spyOn( process.stderr, 'write' ).mockImplementation( ( chunk ) => stderr.push( String( chunk ) ) > 0 );
        process.exitCode = undefined;
    } );

    afterEach( () => {
        vi.restoreAllMocks();
        process.exitCode = undefined;
    } );

    const printed = () => stripVTControlCharacters( stdout.join( '' ) );
    const errors = () => stripVTControlCharacters( stderr.join( '' ) );

    it( 'inserts every table in order, in one transaction, with the hashed password', async () => {
        const { database, manager } = databaseWith();

        await new SeedCommand( database, config() ).run( [], {} );

        expect( argon2.hash ).toHaveBeenCalledWith( SEED_PASSWORD );
        expect( manager.query ).not.toHaveBeenCalled();
        expect( manager.insert ).toHaveBeenCalledTimes( 15 );
        expect( manager.insert ).toHaveBeenNthCalledWith( 1, User, expect.arrayContaining( [
            expect.objectContaining( { email: 'admin@example.com', passwordHash: 'hashed' } ),
        ] ) );
        expect( printed() ).toContain( '✔ 5 users' );
        expect( printed() ).toContain( 'study sessions' );
        expect( printed() ).toContain( `Log in with password ${SEED_PASSWORD} as:` );
        expect( printed() ).toMatch( /admin@example\.com\s+superadmin/ );
        expect( errors() ).toBe( '' );
        expect( process.exitCode ).toBeUndefined();
    } );

    it( 'checks for the dummy users by email before inserting', async () => {
        const { database, manager } = databaseWith();

        await new SeedCommand( database, config() ).run( [], {} );

        expect( manager.existsBy ).toHaveBeenCalledWith( User, {
            email: expect.objectContaining( { value: expect.arrayContaining( [ 'alice@example.com', 'dave@example.com' ] ) } ),
        } );
    } );

    it( 'refuses to insert twice, pointing at --reset', async () => {
        const { database, manager } = databaseWith( { seeded: true } );

        await new SeedCommand( database, config() ).run( [], {} );

        expect( manager.insert ).not.toHaveBeenCalled();
        expect( errors() ).toContain( 'db:seed --reset' );
        expect( process.exitCode ).toBe( 1 );
    } );

    it( '--reset empties every table first, then inserts', async () => {
        const { database, manager } = databaseWith( { seeded: true } );

        await new SeedCommand( database, config( 'development' ) ).run( [], { reset: true } );

        expect( manager.query ).toHaveBeenCalledWith( 'TRUNCATE "users", "items" CASCADE' );
        expect( manager.existsBy ).not.toHaveBeenCalled();
        expect( manager.insert ).toHaveBeenCalledTimes( 15 );
        expect( errors() ).toContain( 'Deleted all existing data.' );
    } );

    it( 'reports a failed insert without printing any counts', async () => {
        const { database } = databaseWith( { insertError: new Error( 'duplicate key value' ) } );

        await new SeedCommand( database, config() ).run( [], {} );

        expect( errors() ).toContain( 'duplicate key value' );
        expect( printed() ).toBe( '' );
        expect( process.exitCode ).toBe( 1 );
    } );

    it( 'never runs against production', async () => {
        const { database, withDataSource } = databaseWith();
        const get = vi.fn( () => 'production' );

        await new SeedCommand( database, { get } as unknown as ConfigService ).run( [], { reset: true } );

        expect( withDataSource ).not.toHaveBeenCalled();
        expect( get ).toHaveBeenCalledWith( 'NODE_ENV' );
        expect( errors() ).toContain( 'NODE_ENV is production' );
        expect( process.exitCode ).toBe( 1 );
    } );

    it( 'has a --reset flag', () => {
        const { database } = databaseWith();

        expect( new SeedCommand( database, config() ).parseReset() ).toBe( true );
    } );
} );
