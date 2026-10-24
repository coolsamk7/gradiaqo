import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Membership, OrganizationRole, User } from '@studylog/database';
import * as argon2 from 'argon2';
import type { DataSource } from 'typeorm';

import { AccountService } from '../../../../src/auth/services/account.service.js';
import type { SessionsService } from '../../../../src/auth/services/sessions.service.js';
import type { UsersService } from '../../../../src/users/services/users.service.js';
import type { FakeDataSource } from '../../fake-data-source.js';
import { fakeDataSource } from '../../fake-data-source.js';

const organization = ( id: string, isPersonal = false ) => ( { id, name: `Org ${id}`, isPersonal } );
const ownerOf = ( org: ReturnType<typeof organization> ) => ( { organizationId: org.id, organization: org } );

describe( 'AccountService', () => {
    let db: FakeDataSource;
    let sessions: { revokeOthers: ReturnType<typeof vi.fn> };
    let service: AccountService;

    beforeEach( async () => {
        db = fakeDataSource();
        sessions = { revokeOthers: vi.fn() };

        const passwordHash = await argon2.hash( 'right' );
        const users = {
            findByIdWithPassword: vi.fn().mockResolvedValue( { id: 'user-1', passwordHash } ),
            findByIdOrFail: vi.fn().mockResolvedValue( { id: 'user-1', passwordHash: 'x', firstName: 'New' } ),
        };

        service = new AccountService(
            db as unknown as DataSource,
            users as unknown as UsersService,
            sessions as unknown as SessionsService,
        );
    } );

    it( 'updateProfile never returns the password hash', async () => {
        const user = await service.updateProfile( 'user-1', { firstName: 'New' } );

        expect( db.repo( User ).update ).toHaveBeenCalledWith( { id: 'user-1' }, { firstName: 'New' } );
        expect( user ).not.toHaveProperty( 'passwordHash' );
    } );

    describe( 'changePassword', () => {
        it( 'needs the current password', async () => {
            await expect( service.changePassword( 'user-1', 'wrong', 'newpassword', undefined ) )
                .rejects.toThrow( UnauthorizedException );
            expect( db.repo( User ).update ).not.toHaveBeenCalled();
        } );

        it( 'stores a hash of the new password and signs out other devices', async () => {
            await service.changePassword( 'user-1', 'right', 'newpassword', 'this-device-token' );

            const { passwordHash } = db.repo( User ).update.mock.calls[0][1] as { passwordHash: string };

            expect( await argon2.verify( passwordHash, 'newpassword' ) ).toBe( true );
            expect( sessions.revokeOthers ).toHaveBeenCalledWith( 'user-1', 'this-device-token' );
        } );
    } );

    describe( 'deleteAccount', () => {
        it( 'needs the password', async () => {
            await expect( service.deleteAccount( 'user-1', 'wrong' ) ).rejects.toThrow( UnauthorizedException );
            expect( db.repo( User ).delete ).not.toHaveBeenCalled();
        } );

        it( 'deletes the personal workspace and organizations the user is alone in, then the user', async () => {
            const personal = organization( 'personal', true );
            const solo = organization( 'solo' );

            db.repo( Membership ).find.mockResolvedValue( [ ownerOf( personal ), ownerOf( solo ) ] );

            await service.deleteAccount( 'user-1', 'right' );

            expect( db.manager.remove ).toHaveBeenCalledWith( [ personal, solo ] );
            expect( db.repo( User ).delete ).toHaveBeenCalledWith( { id: 'user-1' } );
        } );

        it( 'keeps organizations that have another owner', async () => {
            const shared = organization( 'shared' );

            db.repo( Membership ).find.mockResolvedValue( [ ownerOf( shared ) ] );
            // Other members exist, and one of them is an owner.
            db.repo( Membership ).existsBy.mockResolvedValue( true );

            await service.deleteAccount( 'user-1', 'right' );

            expect( db.manager.remove ).toHaveBeenCalledWith( [] );
            expect( db.repo( User ).delete ).toHaveBeenCalled();
        } );

        it( 'refuses while the user is the only owner of an organization with other members', async () => {
            db.repo( Membership ).find.mockResolvedValue( [ ownerOf( organization( 'group' ) ) ] );
            // Other members, but no other owner.
            db.repo( Membership ).existsBy.mockImplementation( ( where: { role?: OrganizationRole } ) =>
                Promise.resolve( where.role !== OrganizationRole.Owner ) );

            await expect( service.deleteAccount( 'user-1', 'right' ) ).rejects.toThrow( ConflictException );
            await expect( service.deleteAccount( 'user-1', 'right' ) ).rejects.toThrow( '"Org group"' );
            expect( db.repo( User ).delete ).not.toHaveBeenCalled();
        } );
    } );
} );
