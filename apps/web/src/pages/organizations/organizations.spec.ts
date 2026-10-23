import { OrganizationRole } from '@studylog/schemas/enums';

import { ApiError, NetworkError } from '../../api/client.ts';
import { canManage, count, expiresIn, initials, loadError, saveError, sentAgo, withArticle } from './organizations.ts';

const NOW = new Date( '2026-10-23T12:00:00Z' );
const inDays = ( days: number ) => new Date( NOW.getTime() + days * 24 * 60 * 60 * 1000 ).toISOString();

describe( 'organization helpers', () => {
    it( 'say when an invitation expires and when it was sent', () => {
        expect( expiresIn( inDays( 12 ), NOW ) ).toBe( 'expires in 12 days' );
        expect( expiresIn( inDays( 1 ), NOW ) ).toBe( 'expires tomorrow' );
        expect( expiresIn( inDays( 0.2 ), NOW ) ).toBe( 'expires tomorrow' );
        expect( expiresIn( inDays( -1 ), NOW ) ).toBe( 'expires today' );
        expect( sentAgo( inDays( -3 ), NOW ) ).toBe( 'sent 3 days ago' );
        expect( sentAgo( inDays( -1 ), NOW ) ).toBe( 'sent yesterday' );
        expect( sentAgo( inDays( -0.5 ), NOW ) ).toBe( 'sent today' );
    } );

    it( 'name roles and people', () => {
        expect( withArticle( OrganizationRole.Member ) ).toBe( 'a Member' );
        expect( withArticle( OrganizationRole.Admin ) ).toBe( 'an Admin' );
        expect( withArticle( OrganizationRole.Owner ) ).toBe( 'an Owner' );
        expect( canManage( OrganizationRole.Admin ) ).toBe( true );
        expect( canManage( OrganizationRole.Member ) ).toBe( false );
        expect( canManage( null ) ).toBe( false );
        expect( initials( 'carol', 'nguyen' ) ).toBe( 'CN' );
        expect( count( 1, 'path' ) ).toBe( '1 path' );
        expect( count( 3, 'member' ) ).toBe( '3 members' );
    } );

    it( 'explain why loading failed', () => {
        expect( loadError( new NetworkError() ) ).toMatch( /^Can't reach StudyLog/ );
        expect( loadError( new ApiError( 404, 'Not Found' ) ) ).toBe( 'This organization isn\'t here, or you\'re not a member.' );
        expect( loadError( new ApiError( 403, 'Forbidden' ) ) ).toBe( 'This organization isn\'t here, or you\'re not a member.' );
        expect( loadError( new ApiError( 500, 'Oops' ) ) ).toBe( 'Something went wrong while loading. Please try again.' );
    } );

    it( 'pass on the API\'s explanations of refused changes', () => {
        expect( saveError( new NetworkError() ) ).toMatch( /^Can't reach StudyLog/ );
        expect( saveError( new ApiError( 403, 'Forbidden' ) ) ).toBe( 'Only the organization\'s owners and admins can do that.' );
        expect( saveError( new ApiError( 409, 'An organization needs an owner: make someone else owner first' ) ) )
            .toBe( 'An organization needs an owner: make someone else owner first.' );
        expect( saveError( new ApiError( 400, 'Not possible in a personal workspace.' ) ) ).toBe( 'Not possible in a personal workspace.' );
        expect( saveError( new ApiError( 400, 'Bad Request', { fieldErrors: { name: 'too long' } } ) ) )
            .toBe( 'Something went wrong, so nothing changed. Please try again.' );
        expect( saveError( new ApiError( 500, 'Oops' ) ) ).toBe( 'Something went wrong, so nothing changed. Please try again.' );
    } );
} );
