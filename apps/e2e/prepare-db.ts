/*
 * Gets the test database ready before the API starts: creates it if needed, applies the migrations and replaces
 * everything in it with the dummy data from `yarn cli db:seed`. Run by playwright.config.ts.
 */
import { spawnSync } from 'node:child_process';

import pg from 'pg';

import { DATABASE_URL } from './settings.ts';

const url = new URL( DATABASE_URL );
const name = decodeURIComponent( url.pathname.slice( 1 ) );

// The seed empties every table first: never let it near a database that isn't meant for these tests.
if ( !name.endsWith( '_e2e' ) ) {
    throw new Error( `The UI test database's name must end in _e2e (got "${name}"), because every run empties it.` );
}

// CREATE DATABASE can't run inside the database it creates: connect to the server's default one.
const admin = new pg.Client( { connectionString: Object.assign( new URL( url ), { pathname: '/postgres' } ).toString() } );

try {
    await admin.connect();
} catch ( error ) {
    throw new Error( `Can't reach PostgreSQL at ${url.host}. Start it with: yarn db:up`, { cause: error } );
}
try {
    const { rowCount } = await admin.query( 'SELECT 1 FROM pg_database WHERE datname = $1', [ name ] );

    if ( rowCount === 0 ) {
        await admin.query( `CREATE DATABASE "${name.replaceAll( '"', '""' )}"` );
        process.stdout.write( `Created the database ${name}\n` );
    }
} finally {
    await admin.end();
}

for ( const command of [ [ 'migration:run' ], [ 'db:seed', '--reset' ] ] ) {
    const result = spawnSync( 'yarn', [ 'workspace', '@studylog/cli', 'start', ...command ], {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL },
    } );

    if ( result.status !== 0 ) {
        throw new Error( `yarn cli ${command.join( ' ' )} failed on ${name}` );
    }
}
