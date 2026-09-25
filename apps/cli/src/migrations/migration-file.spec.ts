import { writeFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

import { buildMigrationFile, toPascalCase, writeMigrationFile } from './migration-file.js';

vi.mock( 'node:fs/promises', () => ( { writeFile: vi.fn() } ) );

describe( 'toPascalCase', () => {
    it.each( [
        [ 'add-study-sessions', 'AddStudySessions' ],
        [ 'add study sessions', 'AddStudySessions' ],
        [ 'addStudySessions', 'AddStudySessions' ],
        [ 'init', 'Init' ],
    ] )( '%s → %s', ( input, expected ) => {
        expect( toPascalCase( input ) ).toBe( expected );
    } );

    it( 'rejects names that would not make a valid class name', () => {
        expect( () => toPascalCase( '' ) ).toThrow( 'Invalid migration name' );
        expect( () => toPascalCase( '2fast' ) ).toThrow( 'Invalid migration name' );
    } );
} );

describe( 'buildMigrationFile', () => {
    const file = buildMigrationFile(
        'add-study-sessions',
        [ { query: 'CREATE TABLE "a" ("note" text DEFAULT \'`${x}` \\d\')' }, { query: 'COMMENT ON x IS $1', parameters: [ 'hi' ] } ],
        [ { query: 'DROP TABLE "a"' } ],
        1727000000000,
    );

    it( 'names the class and file with the timestamp TypeORM orders by', () => {
        expect( file.className ).toBe( 'AddStudySessions1727000000000' );
        expect( file.fileName ).toBe( '1727000000000-add-study-sessions.ts' );
        expect( file.path ).toMatch( /packages\/database\/src\/migrations\/1727000000000-add-study-sessions\.ts$/ );
    } );

    it( 'escapes backticks, ${ and backslashes so the SQL survives the template literal', () => {
        const [ , literal ] = /query\( (`[^\n]*`) \);/.exec( file.content ) ?? [];

        // Evaluating the emitted literal (sandboxed) must give back the original SQL exactly.
        expect( runInNewContext( literal ?? '' ) ).toBe( 'CREATE TABLE "a" ("note" text DEFAULT \'`${x}` \\d\')' );
    } );

    it( 'passes query parameters through', () => {
        expect( file.content ).toContain( 'await queryRunner.query( `COMMENT ON x IS $1`, ["hi"] );' );
    } );

    it( 'renders an empty migration with a hint', () => {
        expect( buildMigrationFile( 'backfill', [], [] ).content ).toContain( '// Write your migration here' );
    } );
} );

describe( 'writeMigrationFile', () => {
    it( 'never overwrites an existing file', async () => {
        const file = buildMigrationFile( 'add-things', [], [], 1727000000000 );

        await writeMigrationFile( file );

        expect( writeFile ).toHaveBeenCalledWith( file.path, file.content, { flag: 'wx' } );
    } );
} );
