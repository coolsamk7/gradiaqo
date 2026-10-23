import { ItemType, PlatformRole } from '@studylog/schemas';
import { describe, expect, it } from 'vitest';

import { ItemDetails, ListItemsQueryParams, Responses, SignupBody } from './index.js';

describe( '@studylog/nestjs wrappers', () => {
    it( 'has a details validator for every item type', () => {
        expect( Object.keys( ItemDetails ).sort() ).toEqual( Object.values( ItemType ).sort() );
        expect( ItemDetails[ItemType.Video].safeParse( { url: 'https://youtu.be/x' } ).issues ).toBeUndefined();
        expect( ItemDetails[ItemType.Video].safeParse( { content: 'x' } ).issues?.map( ( issue ) => issue.path ) )
            .toEqual( expect.arrayContaining( [ '/url', '/content' ] ) );
    } );

    it( 'responses encode dates and strip fields that aren\'t in the contract (like a password hash)', () => {
        const at = new Date( '2026-01-02T03:04:05.000Z' );
        const user = Responses.User.parse( {
            id: '97f12719-9f4c-41c9-afc3-a91de613d02b',
            email: 'a@b.co',
            firstName: 'A',
            lastName: 'B',
            platformRole: PlatformRole.ApplicationUser,
            emailVerifiedAt: null,
            createdAt: at,
            updatedAt: at,
            passwordHash: 'secret',
        } );

        expect( user ).not.toHaveProperty( 'passwordHash' );
        expect( user.createdAt ).toBe( '2026-01-02T03:04:05.000Z' );
    } );

    it( 'request bodies reject unknown fields, e.g. choosing your own role at signup', () => {
        const result = SignupBody.safeParse( { email: 'a@b.co', firstName: 'A', lastName: 'B', password: 'supersecret1', platformRole: 'superadmin' } );

        expect( result.issues ).toEqual( [ expect.objectContaining( { path: '/platformRole', message: 'is not allowed' } ) ] );
    } );

    it( 'query strings are converted to numbers', () => {
        expect( ListItemsQueryParams.parse( { limit: '20', offset: '40' } ) ).toMatchObject( { limit: 20, offset: 40 } );
    } );
} );
