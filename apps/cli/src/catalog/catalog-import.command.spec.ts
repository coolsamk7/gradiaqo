import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { stripVTControlCharacters } from 'node:util';

import { CatalogStatus, Item, LearningModule, LearningPath } from '@studylog/database';
import type { DataSource, EntityManager } from 'typeorm';

import type { DatabaseService } from '../database/database.service.js';
import { fakeManager } from '../test/fake-manager.js';
import { CatalogImportCommand, readInput } from './catalog-import.command.js';

const FILE = `
slug: dsa
title: DSA
modules:
  - title: Arrays
    topics:
      - title: Hashing
        items:
          - leetcode: two-sum
            title: Two Sum
          - type: note
            title: Hash maps
            content: Counting.
      - title: Pairs
        items:
          - leetcode: two-sum
            title: Two Sum
`;

/** A DatabaseService over an in-memory catalog; `failWith` makes the transaction fail. */
function databaseWith( db = fakeManager(), failWith?: Error ) {
    const dataSource = {
        transaction: ( work: ( manager: EntityManager ) => Promise<unknown> ) =>
            ( failWith ? Promise.reject( failWith ) : work( db.manager ) ),
    };
    const database = {
        withDataSource: ( work: ( ds: DataSource ) => Promise<unknown> ) => work( dataSource as unknown as DataSource ),
    };

    return { command: new CatalogImportCommand( database as unknown as DatabaseService ), db };
}

describe( 'catalog:import', () => {
    let dir: string;
    let stdout: string[];
    let stderr: string[];

    beforeEach( async () => {
        dir = await mkdtemp( join( tmpdir(), 'catalog-import-' ) );
        await writeFile( join( dir, 'dsa.yaml' ), FILE );
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

    it( 'imports the file and says what changed', async () => {
        const { command, db } = databaseWith();

        await command.run( [ join( dir, 'dsa.yaml' ) ], {} );

        expect( db.rows( LearningPath ) ).toHaveLength( 1 );
        expect( printed() ).toBe( [
            '✔ DSA (dsa): created, draft',
            '  1 module: 1 new, 0 changed',
            '  2 topics: 2 new, 0 changed',
            '  2 items: 2 new, 0 changed · 3 added to topics, 0 taken out',
            'Learners see it once it\'s published: Admin › Catalog, or PATCH /admin/catalog/paths/:id.',
            '',
        ].join( '\n' ) );
        expect( errors() ).toBe( '' );
    } );

    it( 'says when the path was only updated or already there, and what the file left out', async () => {
        const { command, db } = databaseWith();

        await command.run( [ join( dir, 'dsa.yaml' ) ], {} );
        db.rows( LearningPath )[0].status = CatalogStatus.Published;
        db.add( LearningModule, { learningPathId: db.rows( LearningPath )[0].id, slug: 'old', title: 'Old', position: 1 } );
        stdout.length = 0;

        await command.run( [ join( dir, 'dsa.yaml' ) ], {} );
        expect( printed() ).toMatch( /^✔ DSA \(dsa\): already there, published\n/ );
        expect( printed() ).not.toContain( 'Learners see it' );
        expect( errors() ).toBe( '! Not in the file, kept: module "Old"\n' );

        db.rows( Item ).find( ( row ) => row.title === 'Hash maps' )!.status = CatalogStatus.Draft;
        stderr.length = 0;
        await command.run( [ join( dir, 'dsa.yaml' ) ], {} );
        expect( errors() ).toContain(
            '! Not published, so learners don\'t see it: "Hash maps" (draft) (publish it in Admin › Catalog › Items)\n',
        );

        await writeFile( join( dir, 'dsa.yaml' ), FILE.replace( 'title: DSA', 'title: Data Structures' ) );
        stdout.length = 0;
        await command.run( [ join( dir, 'dsa.yaml' ) ], {} );
        expect( printed() ).toMatch( /^✔ Data Structures \(dsa\): updated, published\n/ );
    } );

    it( 'saves nothing on a dry run', async () => {
        const db = fakeManager();
        const rollback = vi.fn();
        const dataSource = {
            // Like TypeORM: a throw inside the transaction rolls it back and rethrows.
            transaction: async ( work: ( manager: EntityManager ) => Promise<unknown> ) => {
                try {
                    return await work( db.manager );
                } catch ( error ) {
                    rollback();
                    throw error;
                }
            },
        };
        const database = {
            withDataSource: ( work: ( ds: DataSource ) => Promise<unknown> ) =>
                work( dataSource as unknown as DataSource ),
        };
        const command = new CatalogImportCommand( database as unknown as DatabaseService );

        await command.run( [ join( dir, 'dsa.yaml' ) ], { dryRun: true } );

        expect( rollback ).toHaveBeenCalledOnce();
        expect( printed() ).toContain( '✔ DSA (dsa): created, draft' );
        expect( errors() ).toBe( '! Dry run: nothing was saved.\n' );
        expect( process.exitCode ).toBeUndefined();
    } );

    it( 'stops on a file with problems, or a database error, with a non-zero exit code', async () => {
        await writeFile( join( dir, 'bad.yaml' ), 'slug: x\n' );
        await databaseWith().command.run( [ join( dir, 'bad.yaml' ) ], {} );
        expect( errors() ).toMatch( /^✖ The file doesn't match the format:/ );
        expect( process.exitCode ).toBe( 1 );

        stderr.length = 0;
        await databaseWith( fakeManager(), new Error( 'connection lost' ) ).command.run( [ join( dir, 'dsa.yaml' ) ], {} );
        expect( errors() ).toBe( '✖ connection lost\n' );
    } );

    it( 'has a --dry-run flag', () => {
        expect( databaseWith().command.parseDryRun() ).toBe( true );
    } );
} );

describe( 'readInput', () => {
    afterEach( () => {
        vi.unstubAllEnvs();
    } );

    it( 'reads a relative path from the folder yarn was run in, or else the current one', async () => {
        const dir = await mkdtemp( join( tmpdir(), 'catalog-cwd-' ) );

        await writeFile( join( dir, 'y.yaml' ), 'found' );
        vi.stubEnv( 'CLI_CWD', dir );
        await expect( readInput( 'y.yaml' ) ).resolves.toBe( 'found' );

        vi.stubEnv( 'CLI_CWD', undefined );
        vi.spyOn( process, 'cwd' ).mockReturnValue( dir );
        await expect( readInput( 'y.yaml' ) ).resolves.toBe( 'found' );
    } );

    it( 'reads a file, or stdin for -', async () => {
        const dir = await mkdtemp( join( tmpdir(), 'catalog-input-' ) );

        await writeFile( join( dir, 'x.yaml' ), 'from a file' );
        await expect( readInput( join( dir, 'x.yaml' ) ) ).resolves.toBe( 'from a file' );
        // Relative to where the command was run.
        await expect( readInput( 'x.yaml', process.stdin, dir ) ).resolves.toBe( 'from a file' );

        await expect( readInput( '-', Readable.from( [ Buffer.from( 'from ' ), 'stdin' ] ) ) ).resolves.toBe( 'from stdin' );
    } );
} );
