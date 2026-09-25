import { relative } from 'node:path';

import { MIGRATIONS_TABLE } from '@studylog/database';
import { Command, CommandRunner, Option } from 'nest-commander';
import type { MigrationInterface } from 'typeorm';

import { DatabaseService } from '../database/database.service.js';
import { output, runSafely } from '../output.js';
import { buildMigrationFile, writeMigrationFile } from './migration-file.js';

const NEXT_STEP = 'Review it, then run `yarn cli migration:run` (this builds the database package first).';

const displayPath = ( path: string ) => relative( process.cwd(), path );

@Command( {
    name: 'migration:generate',
    arguments: '<name>',
    description: 'Create a migration from the difference between the entities and the database',
} )
export class MigrationGenerateCommand extends CommandRunner {
    constructor( private readonly database: DatabaseService ) {
        super();
    }

    @Option( { flags: '--dry-run', description: 'Print the migration instead of writing it' } )
    parseDryRun(): boolean {
        return true;
    }

    @Option( { flags: '--check', description: 'Exit with code 1 if entities have changes without a migration (for CI)' } )
    parseCheck(): boolean {
        return true;
    }

    async run( [ name ]: string[], options: { check?: boolean; dryRun?: boolean } ): Promise<void> {
        await runSafely( async () => {
            const { upQueries, downQueries } = await this.database.withDataSource( ( dataSource ) =>
                dataSource.driver.createSchemaBuilder().log() );

            if ( upQueries.length === 0 ) {
                output.success( 'No changes: the database already matches the entities.' );

                return;
            }
            if ( options.check ) {
                output.error( `The entities have ${upQueries.length} change(s) not covered by a migration.` );
                process.exitCode = 1;

                return;
            }

            // TypeORM returns down queries in apply order; they must run in reverse to undo `up`.
            const file = buildMigrationFile( name ?? '', upQueries, [ ...downQueries ].reverse() );

            if ( options.dryRun ) {
                output.info( file.content );

                return;
            }

            await writeMigrationFile( file );
            output.success( `Created ${displayPath( file.path )} (${upQueries.length} statement(s)).` );
            output.info( output.dim( NEXT_STEP ) );
        } );
    }
}

@Command( { name: 'migration:create', arguments: '<name>', description: 'Create an empty migration to write by hand' } )
export class MigrationCreateCommand extends CommandRunner {
    async run( [ name ]: string[] ): Promise<void> {
        await runSafely( async () => {
            const file = buildMigrationFile( name ?? '', [], [] );

            await writeMigrationFile( file );
            output.success( `Created ${displayPath( file.path )}.` );
            output.info( output.dim( NEXT_STEP ) );
        } );
    }
}

@Command( { name: 'migration:run', description: 'Apply all pending migrations (each in its own transaction)' } )
export class MigrationRunCommand extends CommandRunner {
    constructor( private readonly database: DatabaseService ) {
        super();
    }

    @Option( {
        flags: '--fake',
        description: 'Record pending migrations as applied without running them (for a database that already has the schema)',
    } )
    parseFake(): boolean {
        return true;
    }

    async run( _params: string[], options: { fake?: boolean } ): Promise<void> {
        await runSafely( async () => {
            const applied = await this.database.withDataSource( async ( dataSource ) => {
                // TypeORM returns nothing for fake runs, so work out what's pending ourselves.
                const before = new Set( await lastApplied( dataSource.query.bind( dataSource ) ) );
                const pending = dataSource.migrations
                    .map( migrationName )
                    .filter( ( name ) => !before.has( name ) )
                    .sort( byTimestamp );

                await dataSource.runMigrations( { transaction: 'each', fake: options.fake ?? false } );

                return pending;
            } );

            if ( applied.length === 0 ) {
                output.success( 'Database is up to date.' );

                return;
            }
            for ( const name of applied ) {
                output.success( `${options.fake ? 'Marked as applied (not run)' : 'Applied'} ${name}` );
            }
        } );
    }
}

@Command( { name: 'migration:revert', description: 'Undo the most recently applied migration' } )
export class MigrationRevertCommand extends CommandRunner {
    constructor( private readonly database: DatabaseService ) {
        super();
    }

    async run(): Promise<void> {
        await runSafely( async () => {
            const reverted = await this.database.withDataSource( async ( dataSource ) => {
                const [ last ] = await lastApplied( dataSource.query.bind( dataSource ) );

                await dataSource.undoLastMigration( { transaction: 'each' } );

                return last;
            } );

            output.success( reverted ? `Reverted ${reverted}` : 'Nothing to revert.' );
        } );
    }
}

@Command( { name: 'migration:show', description: 'List migrations and whether each has been applied' } )
export class MigrationShowCommand extends CommandRunner {
    constructor( private readonly database: DatabaseService ) {
        super();
    }

    async run(): Promise<void> {
        await runSafely( async () => {
            const { all, applied } = await this.database.withDataSource( async ( dataSource ) => ( {
                all: dataSource.migrations.map( migrationName ),
                applied: new Set( await lastApplied( dataSource.query.bind( dataSource ) ) ),
            } ) );

            if ( all.length === 0 ) {
                output.info( 'No migrations yet.' );

                return;
            }
            for ( const name of all.sort( byTimestamp ) ) {
                output.info( `${applied.has( name ) ? '[x]' : '[ ]'} ${name}` );
            }

            const pending = all.filter( ( name ) => !applied.has( name ) ).length;

            output.info( output.dim( `${all.length - pending} applied, ${pending} pending` ) );
        } );
    }
}

type Query = ( sql: string ) => Promise<{ name: string }[]>;

/** Applied migration names, newest first. Empty if the migrations table doesn't exist yet. */
async function lastApplied( query: Query ): Promise<string[]> {
    const [ table ] = await query( `SELECT to_regclass('${MIGRATIONS_TABLE}') AS name` );

    if ( !table?.name ) {
        return [];
    }

    return ( await query( `SELECT name FROM "${MIGRATIONS_TABLE}" ORDER BY "timestamp" DESC, id DESC` ) ).map( ( row ) => row.name );
}

/** A migration's `name`, or its class name for migrations that don't set one. */
function migrationName( migration: MigrationInterface ): string {
    return migration.name ?? migration.constructor.name;
}

function byTimestamp( a: string, b: string ): number {
    const timestamp = ( name: string ) => Number( /(\d{13})$/.exec( name )?.[1] ?? 0 );

    return timestamp( a ) - timestamp( b );
}
