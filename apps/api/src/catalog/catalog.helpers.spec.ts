import { BadRequestException, ConflictException } from '@nestjs/common';
import { CatalogStatus } from '@studylog/database';
import { QueryFailedError } from 'typeorm';

import { assertDeletable, assertSameChildren, saveUnique, toSlug, writePositions } from './catalog.helpers.js';

describe( 'toSlug', () => {
    it.each( [
        [ 'Data Structures & Algorithms', 'data-structures-algorithms' ],
        [ '  Two   Pointers  ', 'two-pointers' ],
        [ 'Café Déjà Vu', 'cafe-deja-vu' ],
        [ 'C++ -- Basics', 'c-basics' ],
        [ '!!!', 'untitled' ],
    ] )( '%s → %s', ( title, slug ) => {
        expect( toSlug( title ) ).toBe( slug );
    } );

    it( 'never ends with a dash after truncating', () => {
        expect( toSlug( `${'a'.repeat( 119 )} b` ) ).toBe( 'a'.repeat( 119 ) );
    } );
} );

describe( 'assertSameChildren', () => {
    it( 'accepts every current child exactly once, in any order', () => {
        expect( () => assertSameChildren( [ 'b', 'a' ], [ 'a', 'b' ] ) ).not.toThrow();
        expect( () => assertSameChildren( [], [] ) ).not.toThrow();
    } );

    it( 'rejects missing, extra or unknown ids', () => {
        expect( () => assertSameChildren( [ 'a' ], [ 'a', 'b' ] ) ).toThrow( BadRequestException );
        expect( () => assertSameChildren( [ 'a', 'b', 'c' ], [ 'a', 'b' ] ) ).toThrow( BadRequestException );
        expect( () => assertSameChildren( [ 'a', 'c' ], [ 'a', 'b' ] ) ).toThrow( BadRequestException );
    } );
} );

describe( 'assertDeletable', () => {
    it( 'allows deleting only drafts from the global catalog', () => {
        expect( () => assertDeletable( null, { status: CatalogStatus.Draft }, 'topic' ) ).not.toThrow();
        expect( () => assertDeletable( null, { status: CatalogStatus.Published }, 'topic' ) ).toThrow( ConflictException );
        expect( () => assertDeletable( null, { status: CatalogStatus.Archived }, 'topic' ) ).toThrow( ConflictException );
    } );

    it( 'allows deleting anything from an organization\'s own catalog', () => {
        expect( () => assertDeletable( 'org-1', { status: CatalogStatus.Published }, 'topic' ) ).not.toThrow();
    } );
} );

describe( 'saveUnique', () => {
    it( 'turns a unique violation into a 409 and passes other errors on', async () => {
        const unique = new QueryFailedError( 'INSERT', [], Object.assign( new Error(), { code: '23505' } ) );

        await expect( saveUnique( () => Promise.reject( unique ), 'Slug taken' ) ).rejects.toThrow( new ConflictException( 'Slug taken' ) );
        await expect( saveUnique( () => Promise.reject( new Error( 'down' ) ), 'Slug taken' ) ).rejects.toThrow( 'down' );
        await expect( saveUnique( () => Promise.resolve( 'saved' ), 'Slug taken' ) ).resolves.toBe( 'saved' );
    } );
} );

describe( 'writePositions', () => {
    const manager = () => ( { query: vi.fn() } );

    it( 'numbers the ids 1..n within the parent, in one statement', async () => {
        const m = manager();

        await writePositions( m as never, 'topics', [ 'b', 'a' ], { column: 'module_id', value: 'mod' } );

        expect( m.query ).toHaveBeenCalledWith( expect.stringContaining( 't."module_id" = $2' ), [ [ 'b', 'a' ], 'mod' ] );
    } );

    it( 'matches a null parent with IS NULL (global paths)', async () => {
        const m = manager();

        await writePositions( m as never, 'learning_paths', [ 'a' ], { column: 'organization_id', value: null } );

        expect( m.query ).toHaveBeenCalledWith( expect.stringContaining( 't."organization_id" IS NULL' ), [ [ 'a' ] ] );
    } );

    it( 'does nothing for no ids', async () => {
        const m = manager();

        await writePositions( m as never, 'topics', [], { column: 'module_id', value: 'mod' } );

        expect( m.query ).not.toHaveBeenCalled();
    } );
} );
