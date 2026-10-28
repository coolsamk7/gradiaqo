import type { PathImportResultJson } from '@studylog/schemas';
import { MAX_PATH_FILE_LENGTH } from '@studylog/schemas';
import { CatalogStatus } from '@studylog/schemas/enums';

import { ApiError, NetworkError } from '../../api/client.ts';
import { changeLines, changesSomething, importError, PathFileError, pathOutcome, readPathFile } from './path-import.ts';

const result = ( overrides: Partial<PathImportResultJson> = {} ): PathImportResultJson => ( {
    dryRun: true,
    path: { id: 'p', slug: 'dsa', title: 'DSA', status: CatalogStatus.Draft, created: false, updated: false },
    modules: { total: 1, created: 0, updated: 0 },
    topics: { total: 2, created: 0, updated: 0 },
    items: { total: 1, created: 0, updated: 0, linked: 0, unlinked: 0 },
    notInFile: [],
    unpublishedItems: [],
    ...overrides,
} );

describe( 'importing a path file', () => {
    it( 'reads the file, refusing an empty or too big one', async () => {
        await expect( readPathFile( new File( [ 'slug: dsa' ], 'dsa.yaml' ) ) ).resolves.toBe( 'slug: dsa' );
        await expect( readPathFile( new File( [ ' \n' ], 'empty.yaml' ) ) ).rejects.toThrow( new PathFileError( 'The file is empty.' ) );
        await expect( readPathFile( new File( [ 'x'.repeat( MAX_PATH_FILE_LENGTH + 1 ) ], 'big.yaml' ) ) )
            .rejects.toThrow( 'The file is too big: 90,001 characters, and the most is 90,000.' );
    } );

    it( 'says what happens to the path', () => {
        expect( pathOutcome( result( { path: { ...result().path, created: true } } ) ) ).toBe( 'New path, a draft' );
        expect( pathOutcome( result( { path: { ...result().path, updated: true, status: CatalogStatus.Published } } ) ) ).toBe( 'Updated, published' );
        expect( pathOutcome( result( { path: { ...result().path, status: CatalogStatus.Archived } } ) ) ).toBe( 'Already there, archived' );
    } );

    it( 'counts what changes, in words', () => {
        expect( changeLines( result( {
            modules: { total: 1, created: 1, updated: 0 },
            items: { total: 3, created: 2, updated: 1, linked: 3, unlinked: 1 },
        } ) ) ).toEqual( [
            '1 module: 1 new, 0 changed',
            '2 topics: 0 new, 0 changed',
            '3 items: 2 new, 1 changed · 3 added to topics, 1 taken out',
        ] );
    } );

    it( 'knows when nothing would change', () => {
        expect( changesSomething( result() ) ).toBe( false );
        expect( changesSomething( result( { path: { ...result().path, created: true } } ) ) ).toBe( true );
        expect( changesSomething( result( { path: { ...result().path, updated: true } } ) ) ).toBe( true );
        expect( changesSomething( result( { topics: { total: 2, created: 0, updated: 1 } } ) ) ).toBe( true );
        expect( changesSomething( result( { items: { ...result().items, created: 1 } } ) ) ).toBe( true );
        expect( changesSomething( result( { items: { ...result().items, linked: 1 } } ) ) ).toBe( true );
        expect( changesSomething( result( { items: { ...result().items, unlinked: 1 } } ) ) ).toBe( true );
    } );

    it( 'lists a file\'s problems one per line, and explains other failures', () => {
        expect( importError( new ApiError( 400, 'The file doesn\'t match the format:\n  /slug: must match pattern\n  /modules: must not have fewer than 1 items' ) ) )
            .toEqual( [ 'The file doesn\'t match the format:', '/slug: must match pattern', '/modules: must not have fewer than 1 items' ] );
        expect( importError( new PathFileError( 'The file is empty.' ) ) ).toEqual( [ 'The file is empty.' ] );
        expect( importError( new NetworkError() ) ).toEqual( [ 'Can\'t reach Gradiaqo right now. Check your connection and try again.' ] );
        expect( importError( new ApiError( 500, 'Internal server error' ) ) ).toEqual( [ 'Something went wrong, so nothing changed. Please try again.' ] );
    } );
} );
