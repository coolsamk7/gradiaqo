import { UnauthorizedException } from '@nestjs/common';
import { PlatformRole, User } from '@studylog/database';
import type { EntityManager, Repository } from 'typeorm';

import { toPublicUser } from '../../../../src/users/public-user.js';
import { UsersService } from '../../../../src/users/services/users.service.js';
import { fakeDataSource, fakeQueryBuilder } from '../../fake-data-source.js';

describe( 'UsersService', () => {
    const db = fakeDataSource();
    const service = new UsersService( db.repo( User ) as unknown as Repository<User> );

    it( 'findByIdOrFail treats a deleted user as logged out', async () => {
        await expect( service.findByIdOrFail( 'gone' ) ).rejects.toThrow( UnauthorizedException );
    } );

    it( 'selects the password hash only when explicitly asked', async () => {
        const query = fakeQueryBuilder( [ { id: 'u', passwordHash: 'hash' } ] );

        db.repo( User ).createQueryBuilder.mockReturnValue( query );

        await service.findByEmailWithPassword( 'sam@example.com' );

        expect( query.addSelect ).toHaveBeenCalledWith( 'user.passwordHash' );
        expect( query.where ).toHaveBeenCalledWith( 'user.email = :email', { email: 'sam@example.com' } );
    } );

    it( 'toPublicUser drops the password hash', () => {
        expect( toPublicUser( { id: 'u', email: 'e', passwordHash: 'secret' } as User ) ).toEqual( { id: 'u', email: 'e' } );
    } );

    it( 'finds users by id (with or without the password hash) and checks emails', async () => {
        db.repo( User ).findOneBy.mockResolvedValue( { id: 'u' } );
        expect( await service.findByIdOrFail( 'u' ) ).toEqual( { id: 'u' } );

        const query = fakeQueryBuilder( [ { id: 'u', passwordHash: 'hash' } ] );

        db.repo( User ).createQueryBuilder.mockReturnValue( query );
        expect( await service.findByIdWithPassword( 'u' ) ).toEqual( { id: 'u', passwordHash: 'hash' } );
        expect( query.where ).toHaveBeenCalledWith( 'user.id = :id', { id: 'u' } );

        await service.existsByEmail( 'a@b.co' );
        expect( db.repo( User ).existsBy ).toHaveBeenCalledWith( { email: 'a@b.co' } );
    } );

    it( 'creates users in the given transaction, or directly', async () => {
        const data = { email: 'a@b.co', firstName: 'A', lastName: 'B', passwordHash: 'h', platformRole: PlatformRole.ApplicationUser };
        const inTransaction = fakeDataSource();

        await service.create( data, inTransaction.manager as unknown as EntityManager );
        expect( inTransaction.repo( User ).save ).toHaveBeenCalledWith( expect.objectContaining( data ) );

        await service.create( data );
        expect( db.repo( User ).save ).toHaveBeenCalledWith( expect.objectContaining( data ) );
    } );
} );
