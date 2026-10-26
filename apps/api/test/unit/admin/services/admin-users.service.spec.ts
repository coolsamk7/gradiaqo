import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PlatformRole, User } from '@studylog/database';
import type { DataSource } from 'typeorm';

import { AdminUsersService } from '../../../../src/admin/services/admin-users.service.js';
import type { AccountService } from '../../../../src/auth/services/account.service.js';
import type { FakeDataSource } from '../../fake-data-source.js';
import { fakeDataSource, fakeQueryBuilder } from '../../fake-data-source.js';

const user = ( overrides: object = {} ) => ( {
    id: 'user-1',
    email: 'sam@example.com',
    firstName: 'Sam',
    lastName: 'Khan',
    platformRole: PlatformRole.ApplicationUser,
    passwordHash: 'secret',
    ...overrides,
} );

describe( 'AdminUsersService', () => {
    let db: FakeDataSource;
    let account: { removeAccount: ReturnType<typeof vi.fn> };
    let service: AdminUsersService;

    beforeEach( () => {
        db = fakeDataSource();
        account = { removeAccount: vi.fn() };
        service = new AdminUsersService( db as unknown as DataSource, account as unknown as AccountService );
    } );

    describe( 'list', () => {
        it( 'is every account, newest first, 50 at a time, without password hashes', async () => {
            const query = fakeQueryBuilder( [ user() ], 120 );

            db.repo( User ).createQueryBuilder.mockReturnValue( query );

            const page = await service.list( {} );

            expect( page.total ).toBe( 120 );
            expect( page.items[0] ).toMatchObject( { email: 'sam@example.com' } );
            expect( page.items[0] ).not.toHaveProperty( 'passwordHash' );
            expect( db.repo( User ).createQueryBuilder ).toHaveBeenCalledWith( 'user' );
            expect( query.orderBy ).toHaveBeenCalledWith( 'user.createdAt', 'DESC' );
            expect( query.addOrderBy ).toHaveBeenCalledWith( 'user.id', 'ASC' );
            expect( query.take ).toHaveBeenCalledWith( 50 );
            expect( query.skip ).toHaveBeenCalledWith( 0 );
            expect( query.andWhere ).not.toHaveBeenCalled();
        } );

        it( 'filters by email or name (literally), role and verified email', async () => {
            const query = fakeQueryBuilder();

            db.repo( User ).createQueryBuilder.mockReturnValue( query );

            await service.list( { search: ' 50%_off ', role: PlatformRole.Superadmin, verified: true, limit: 10, offset: 20 } );

            expect( query.andWhere ).toHaveBeenCalledWith(
                '( user.email ILIKE :search OR CONCAT( user.firstName, \' \', user.lastName ) ILIKE :search )',
                { search: '%50\\%\\_off%' },
            );
            expect( query.andWhere ).toHaveBeenCalledWith( 'user.platformRole = :role', { role: PlatformRole.Superadmin } );
            expect( query.andWhere ).toHaveBeenCalledWith( 'user.emailVerifiedAt IS NOT NULL' );
            expect( query.take ).toHaveBeenCalledWith( 10 );
            expect( query.skip ).toHaveBeenCalledWith( 20 );
        } );

        it( 'finds users who haven\'t verified their email', async () => {
            const query = fakeQueryBuilder();

            db.repo( User ).createQueryBuilder.mockReturnValue( query );

            await service.list( { verified: false } );

            expect( query.andWhere ).toHaveBeenCalledWith( 'user.emailVerifiedAt IS NULL' );
        } );
    } );

    describe( 'setRole', () => {
        it( 'promotes a user', async () => {
            db.repo( User ).findOneBy.mockResolvedValue( user() );

            const updated = await service.setRole( 'admin', 'user-1', PlatformRole.Superadmin );

            expect( db.repo( User ).update ).toHaveBeenCalledWith( { id: 'user-1' }, { platformRole: PlatformRole.Superadmin } );
            expect( updated ).toMatchObject( { id: 'user-1', platformRole: PlatformRole.Superadmin } );
            expect( updated ).not.toHaveProperty( 'passwordHash' );
        } );

        it( 'changes nothing when the user already has the role', async () => {
            db.repo( User ).findOneBy.mockResolvedValue( user( { platformRole: PlatformRole.Superadmin } ) );

            await service.setRole( 'admin', 'user-1', PlatformRole.Superadmin );

            expect( db.repo( User ).update ).not.toHaveBeenCalled();
        } );

        it( 'never changes your own role, so a superadmin is always left', async () => {
            await expect( service.setRole( 'admin', 'admin', PlatformRole.ApplicationUser ) )
                .rejects.toThrow( new BadRequestException( 'You can\'t change your own role' ) );
            expect( db.repo( User ).update ).not.toHaveBeenCalled();
        } );

        it( 'is "not found" for an unknown user', async () => {
            await expect( service.setRole( 'admin', 'gone', PlatformRole.Superadmin ) )
                .rejects.toThrow( new NotFoundException( 'User not found' ) );
        } );
    } );

    describe( 'remove', () => {
        it( 'removes the account like the user deleting it, with a refusal worded for an admin', async () => {
            db.repo( User ).findOneBy.mockResolvedValue( user() );

            await service.remove( 'admin', 'user-1' );

            expect( db.repo( User ).findOneBy ).toHaveBeenCalledWith( { id: 'user-1' } );
            type Refusal = ( organizations: string ) => string;
            const [ id, refusal ] = account.removeAccount.mock.calls[0] as [ string, Refusal ];

            expect( id ).toBe( 'user-1' );
            expect( refusal( '"Club"' ) ).toBe( 'They\'re the only owner of "Club", which has other members: someone else has to become owner first' );
        } );

        it( 'never removes yourself or another superadmin', async () => {
            await expect( service.remove( 'admin', 'admin' ) ).rejects.toThrow( new BadRequestException( 'Delete your own account from Settings' ) );

            db.repo( User ).findOneBy.mockResolvedValue( user( { platformRole: PlatformRole.Superadmin } ) );
            await expect( service.remove( 'admin', 'user-1' ) )
                .rejects.toThrow( new ConflictException( 'Make them a normal user first: superadmins can\'t be removed' ) );
            expect( account.removeAccount ).not.toHaveBeenCalled();
        } );

        it( 'is "not found" for an unknown user', async () => {
            await expect( service.remove( 'admin', 'gone' ) ).rejects.toThrow( NotFoundException );
        } );
    } );
} );
