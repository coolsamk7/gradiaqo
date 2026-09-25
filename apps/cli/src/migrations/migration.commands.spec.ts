import { stripVTControlCharacters } from 'node:util';

import type { DataSource } from 'typeorm';

import type { DatabaseService } from '../database/database.service.js';
import {
    MigrationCreateCommand,
    MigrationGenerateCommand,
    MigrationRevertCommand,
    MigrationRunCommand,
    MigrationShowCommand,
} from './migration.commands.js';
import { writeMigrationFile } from './migration-file.js';

// Commands must not write real files in tests.
vi.mock( './migration-file.js', async ( importOriginal ) => ( {
    ...await importOriginal<typeof import( './migration-file.js' )>(),
    writeMigrationFile: vi.fn(),
} ) );

/** A DatabaseService whose data source knows these migrations and answers the "applied" queries. */
function databaseWith( { all = [] as ( string | object )[], applied = [] as string[], schemaChanges = 0 } ) {
    const dataSource = {
        // A string is a migration with a `name`; an object is a migration instance without one (class name is used).
        migrations: all.map( ( migration ) => ( typeof migration === 'string' ? { name: migration } : migration ) ),
        query: vi.fn( ( sql: string ) => Promise.resolve( sql.includes( 'to_regclass' )
            ? [ { name: applied.length > 0 ? 'migrations' : null } ]
            : applied.map( ( name ) => ( { name } ) ) ) ), // newest first
        runMigrations: vi.fn(),
        undoLastMigration: vi.fn(),
        driver: {
            createSchemaBuilder: () => ( {
                log: () => Promise.resolve( {
                    upQueries: Array.from( { length: schemaChanges }, ( _, i ) => ( { query: `UP ${i}` } ) ),
                    downQueries: Array.from( { length: schemaChanges }, ( _, i ) => ( { query: `DOWN ${i}` } ) ),
                } ),
            } ),
        },
    };
    const database = {
        withDataSource: vi.fn( ( work: ( ds: DataSource ) => unknown ) =>
            Promise.resolve( work( dataSource as unknown as DataSource ) ) ),
    };

    return { database: database as unknown as DatabaseService, dataSource };
}

const INIT = 'Init1790315598625';
const CATALOG = 'AddLearningCatalog1790320261790';

describe( 'migration commands', () => {
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
        vi.mocked( writeMigrationFile ).mockClear();
        process.exitCode = undefined;
    } );

    const printed = () => stripVTControlCharacters( stdout.join( '' ) );

    describe( 'migration:run', () => {
        it( 'runs each pending migration in its own transaction and lists them in timestamp order', async () => {
            const { database, dataSource } = databaseWith( { all: [ CATALOG, INIT ], applied: [] } );

            await new MigrationRunCommand( database ).run( [], {} );

            expect( dataSource.runMigrations ).toHaveBeenCalledWith( { transaction: 'each', fake: false } );
            expect( printed() ).toMatch( new RegExp( `Applied ${INIT}[\\s\\S]*Applied ${CATALOG}` ) );
        } );

        it( '--fake records pending migrations without running them', async () => {
            const { database, dataSource } = databaseWith( { all: [ INIT, CATALOG ], applied: [ INIT ] } );

            await new MigrationRunCommand( database ).run( [], { fake: true } );

            expect( dataSource.runMigrations ).toHaveBeenCalledWith( { transaction: 'each', fake: true } );
            expect( printed() ).toContain( `Marked as applied (not run) ${CATALOG}` );
            expect( printed() ).not.toContain( INIT );
        } );

        it( 'says so when there is nothing to do', async () => {
            const { database } = databaseWith( { all: [ INIT ], applied: [ INIT ] } );

            await new MigrationRunCommand( database ).run( [], {} );

            expect( printed() ).toContain( 'Database is up to date' );
        } );

        it( 'prints a failure and sets exit code 1 instead of throwing', async () => {
            const { database, dataSource } = databaseWith( { all: [ INIT ] } );

            dataSource.runMigrations.mockRejectedValue( new Error( 'relation "users" already exists' ) );
            await new MigrationRunCommand( database ).run( [], {} );

            expect( stderr.join( '' ) ).toContain( 'relation "users" already exists' );
            expect( process.exitCode ).toBe( 1 );
        } );
    } );

    it( 'migration:show lists applied and pending migrations', async () => {
        const { database } = databaseWith( { all: [ CATALOG, INIT ], applied: [ INIT ] } );

        await new MigrationShowCommand( database ).run();

        expect( printed() ).toContain( `[x] ${INIT}\n[ ] ${CATALOG}` );
        expect( printed() ).toContain( '1 applied, 1 pending' );
    } );

    it( 'migration:revert names the migration it undid', async () => {
        const { database, dataSource } = databaseWith( { all: [ INIT, CATALOG ], applied: [ CATALOG, INIT ] } );

        await new MigrationRevertCommand( database ).run();

        expect( dataSource.undoLastMigration ).toHaveBeenCalledWith( { transaction: 'each' } );
        expect( printed() ).toContain( `Reverted ${CATALOG}` );
    } );

    describe( 'migration:generate', () => {
        it( 'writes nothing when the database already matches the entities', async () => {
            await new MigrationGenerateCommand( databaseWith( {} ).database ).run( [ 'noop' ], {} );

            expect( printed() ).toContain( 'No changes' );
            expect( writeMigrationFile ).not.toHaveBeenCalled();
        } );

        it( '--check fails (exit code 1) when entities have changes without a migration, for CI', async () => {
            await new MigrationGenerateCommand( databaseWith( { schemaChanges: 2 } ).database ).run( [ 'x' ], { check: true } );

            expect( process.exitCode ).toBe( 1 );
            expect( stderr.join( '' ) ).toContain( '2 change(s) not covered by a migration' );
            expect( writeMigrationFile ).not.toHaveBeenCalled();
        } );

        it( '--dry-run prints the migration, with down queries in reverse order, without writing it', async () => {
            await new MigrationGenerateCommand( databaseWith( { schemaChanges: 2 } ).database ).run( [ 'add-things' ], { dryRun: true } );

            expect( writeMigrationFile ).not.toHaveBeenCalled();
            expect( printed() ).toMatch( /class AddThings\d{13}/ );
            expect( printed() ).toMatch( /DOWN 1[\s\S]*DOWN 0/ );
        } );
    } );

    it( 'the option parsers just switch the flag on', () => {
        const database = databaseWith( {} ).database;

        expect( new MigrationGenerateCommand( database ).parseDryRun() ).toBe( true );
        expect( new MigrationGenerateCommand( database ).parseCheck() ).toBe( true );
        expect( new MigrationRunCommand( database ).parseFake() ).toBe( true );
    } );

    it( 'migration:generate writes the file and says where, relative to the current directory', async () => {
        await new MigrationGenerateCommand( databaseWith( { schemaChanges: 3 } ).database ).run( [ 'add-things' ], {} );

        expect( writeMigrationFile ).toHaveBeenCalledWith( expect.objectContaining( { fileName: expect.stringMatching( /^\d{13}-add-things\.ts$/ ) } ) );
        expect( printed() ).toMatch( /Created \S*packages\/database\/src\/migrations\/\d{13}-add-things\.ts \(3 statement\(s\)\)/ );
        expect( printed() ).toContain( 'yarn cli migration:run' );
    } );

    it( 'migration:create writes an empty migration to fill in', async () => {
        await new MigrationCreateCommand().run( [ 'backfill-slugs' ] );

        expect( writeMigrationFile ).toHaveBeenCalledWith( expect.objectContaining( {
            content: expect.stringContaining( '// Write your migration here' ),
        } ) );
        expect( printed() ).toMatch( /Created \S*-backfill-slugs\.ts\./ );
    } );

    it( 'without a name, generate and create explain the naming rule instead of crashing', async () => {
        await new MigrationCreateCommand().run( [] );
        await new MigrationGenerateCommand( databaseWith( { schemaChanges: 1 } ).database ).run( [], {} );

        expect( stderr.join( '' ) ).toContain( 'Invalid migration name ""' );
        expect( writeMigrationFile ).not.toHaveBeenCalled();
        expect( process.exitCode ).toBe( 1 );
    } );

    it( 'names migrations without a name property after their class, and sorts names without a timestamp first', async () => {
        class Init1790315598625 {}
        const { database } = databaseWith( { all: [ new Init1790315598625(), 'Legacy' ], applied: [] } );

        await new MigrationShowCommand( database ).run();

        expect( printed() ).toContain( `[ ] Legacy\n[ ] ${INIT}` );
    } );

    it( 'says when there is nothing to revert or show', async () => {
        await new MigrationRevertCommand( databaseWith( {} ).database ).run();
        await new MigrationShowCommand( databaseWith( {} ).database ).run();

        expect( printed() ).toContain( 'Nothing to revert.' );
        expect( printed() ).toContain( 'No migrations yet.' );
    } );
} );
