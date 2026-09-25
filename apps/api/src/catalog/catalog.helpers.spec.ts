import { BadRequestException, ConflictException } from '@nestjs/common';
import { CatalogStatus } from '@studylog/database';

import { assertDeletable, assertSameChildren, toSlug } from './catalog.helpers.js';

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
