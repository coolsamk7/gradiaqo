import type { AdminUserJson } from '@studylog/schemas';
import { PlatformRole } from '@studylog/schemas/enums';

import { ApiError, NetworkError } from '../../api/client.ts';
import { USER } from '../../test/api.ts';
import { actionError, lastActive, pageLabel, userActions, usersUrl } from './users.ts';

const user = ( overrides: Partial<AdminUserJson> = {} ): AdminUserJson =>
    ( { ...USER, platformRole: PlatformRole.ApplicationUser, lastActiveAt: null, ...overrides } );

describe( 'users', () => {
    it( 'asks the API for one page of the filtered users', () => {
        expect( usersUrl( { search: '', role: '', verified: '', offset: 0 } ) ).toBe( '/admin/users?limit=50' );
        expect( usersUrl( { search: 'sam k', role: PlatformRole.Superadmin, verified: 'no', offset: 50 } ) )
            .toBe( '/admin/users?search=sam+k&role=superadmin&verified=false&limit=50&offset=50' );
        expect( usersUrl( { search: '', role: '', verified: 'yes', offset: 0 } ) ).toBe( '/admin/users?verified=true&limit=50' );
    } );

    it( 'says when someone was last active', () => {
        const now = new Date( 2026, 9, 26, 12 );

        expect( lastActive( user(), now ) ).toBe( 'Never' );
        expect( lastActive( user( { lastActiveAt: new Date( 2026, 9, 26, 8 ).toISOString() } ), now ) ).toBe( 'Today' );
        expect( lastActive( user( { lastActiveAt: new Date( 2026, 9, 25, 8 ).toISOString() } ), now ) ).toBe( 'Yesterday' );
    } );

    it( 'labels the page', () => {
        expect( pageLabel( 50, 50, 120 ) ).toBe( '51–100 of 120' );
    } );

    describe( 'userActions', () => {
        const shown = ( target: AdminUserJson, myId = 'me' ) =>
            userActions( target, myId, vi.fn(), vi.fn() )
                .filter( ( action ) => !action.hidden )
                .map( ( action ) => action.label );

        it( 'promotes or removes a user, and demotes a superadmin before they can be removed', () => {
            expect( shown( user() ) ).toEqual( [ 'Make superadmin', 'Remove account' ] );
            expect( shown( user( { platformRole: PlatformRole.Superadmin } ) ) ).toEqual( [ 'Make normal user' ] );
        } );

        it( 'offers nothing for yourself', () => {
            expect( shown( user(), USER.id ) ).toEqual( [] );
            expect( shown( user( { platformRole: PlatformRole.Superadmin } ), USER.id ) ).toEqual( [] );
        } );

        it( 'runs the chosen action', () => {
            const setRole = vi.fn();
            const remove = vi.fn();
            const [ promote, demote, removeAction ] = userActions( user(), 'me', setRole, remove );

            promote.onSelect();
            demote.onSelect();
            removeAction.onSelect();
            expect( setRole.mock.calls ).toEqual( [ [ PlatformRole.Superadmin ], [ PlatformRole.ApplicationUser ] ] );
            expect( remove ).toHaveBeenCalledOnce();
            expect( removeAction.danger ).toBe( true );
        } );
    } );

    it( 'explains why a change failed', () => {
        expect( actionError( new NetworkError() ) ).toBe( 'Can\'t reach Gradiaqo right now. Check your connection and try again.' );
        expect( actionError( new ApiError( 409, 'Make them a normal user first.' ) ) ).toBe( 'Make them a normal user first.' );
        expect( actionError( new ApiError( 400, 'You can\'t change your own role' ) ) ).toBe( 'You can\'t change your own role.' );
        expect( actionError( new ApiError( 404, 'User not found' ) ) ).toBe( 'User not found.' );
        expect( actionError( new ApiError( 409, 'Demote them first. Then remove' ) ) ).toBe( 'Demote them first. Then remove.' );
        expect( actionError( new ApiError( 500, 'Boom' ) ) ).toBe( 'Something went wrong, so nothing changed. Please try again.' );
    } );
} );
