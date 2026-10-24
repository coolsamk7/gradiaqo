import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { PlatformRole } from '@studylog/database';
import * as argon2 from 'argon2';
import type { DataSource } from 'typeorm';
import { QueryFailedError } from 'typeorm';

import { AuthService } from '../../../../src/auth/services/auth.service.js';
import type { SessionsService } from '../../../../src/auth/services/sessions.service.js';
import type { VerificationService } from '../../../../src/auth/services/verification.service.js';
import type { OrganizationsService } from '../../../../src/organizations/services/organizations.service.js';
import type { UsersService } from '../../../../src/users/services/users.service.js';
import { fakeDataSource } from '../../fake-data-source.js';

const signup = { email: 'sam@example.com', firstName: 'Sam', lastName: 'K', password: 'supersecret1' };

describe( 'AuthService', () => {
    let users: Record<string, ReturnType<typeof vi.fn>>;
    let sessions: Record<string, ReturnType<typeof vi.fn>>;
    let organizations: Record<string, ReturnType<typeof vi.fn>>;
    let jwt: { signAsync: ReturnType<typeof vi.fn> };
    let verification: { welcome: ReturnType<typeof vi.fn> };
    let service: AuthService;

    beforeEach( () => {
        users = {
            existsByEmail: vi.fn().mockResolvedValue( false ),
            create: vi.fn( ( data: object ) => Promise.resolve( { id: 'user-1', ...data } ) ),
            findByEmailWithPassword: vi.fn().mockResolvedValue( null ),
            findById: vi.fn(),
        };
        sessions = { create: vi.fn().mockResolvedValue( 'session.secret' ), rotate: vi.fn(), revoke: vi.fn() };
        organizations = { createPersonal: vi.fn() };
        jwt = { signAsync: vi.fn().mockResolvedValue( 'access-token' ) };
        verification = { welcome: vi.fn() };
        service = new AuthService(
            users as unknown as UsersService,
            jwt as unknown as JwtService,
            sessions as unknown as SessionsService,
            organizations as unknown as OrganizationsService,
            fakeDataSource() as unknown as DataSource,
            verification as unknown as VerificationService,
        );
    } );

    describe( 'signup', () => {
        it( 'creates an application user with a hashed password and a personal workspace, then a session', async () => {
            const result = await service.signup( signup, {} );
            const created = users.create.mock.calls[0][0] as { passwordHash: string; platformRole: PlatformRole };

            expect( created.platformRole ).toBe( PlatformRole.ApplicationUser );
            expect( created.passwordHash ).not.toBe( signup.password );
            expect( await argon2.verify( created.passwordHash, signup.password ) ).toBe( true );
            expect( organizations.createPersonal ).toHaveBeenCalledOnce();
            expect( result ).toMatchObject( { accessToken: 'access-token', refreshToken: 'session.secret' } );
            expect( result.user ).not.toHaveProperty( 'passwordHash' );
            // The verification code goes out right away.
            expect( verification.welcome ).toHaveBeenCalledWith( expect.objectContaining( { id: 'user-1', email: signup.email } ) );
        } );

        it( 'rejects a registered email', async () => {
            users.existsByEmail.mockResolvedValue( true );

            await expect( service.signup( signup, {} ) ).rejects.toThrow( ConflictException );
            expect( users.create ).not.toHaveBeenCalled();
        } );

        it( 'turns a unique-index race (two signups at once) into a conflict', async () => {
            users.create.mockRejectedValue( new QueryFailedError( 'INSERT', [], Object.assign( new Error(), { code: '23505' } ) ) );

            await expect( service.signup( signup, {} ) ).rejects.toThrow( 'Email is already registered' );
        } );
    } );

    describe( 'login', () => {
        it( 'gives the same error for an unknown email and a wrong password', async () => {
            const unknown = service.login( { email: 'nobody@example.com', password: 'x' }, {} );

            await expect( unknown ).rejects.toThrow( new UnauthorizedException( 'Invalid email or password' ) );

            users.findByEmailWithPassword.mockResolvedValue( { id: 'user-1', passwordHash: await argon2.hash( 'right' ) } );

            await expect( service.login( { email: 'sam@example.com', password: 'wrong' }, {} ) )
                .rejects.toThrow( new UnauthorizedException( 'Invalid email or password' ) );
        } );

        it( 'signs an access token with the user id, email and platform role', async () => {
            users.findByEmailWithPassword.mockResolvedValue( {
                id: 'user-1',
                email: 'sam@example.com',
                platformRole: PlatformRole.Superadmin,
                passwordHash: await argon2.hash( 'right' ),
            } );

            await service.login( { email: 'sam@example.com', password: 'right' }, {} );

            expect( jwt.signAsync ).toHaveBeenCalledWith( {
                sub: 'user-1',
                email: 'sam@example.com',
                platformRole: PlatformRole.Superadmin,
            } );
        } );
    } );

    it( 'refresh fails if the user was deleted since the session started', async () => {
        sessions.rotate.mockResolvedValue( { userId: 'gone', token: 'new' } );
        users.findById.mockResolvedValue( null );

        await expect( service.refresh( 'token', {} ) ).rejects.toThrow( UnauthorizedException );
    } );

    it( 'passes on signup errors other than a duplicate email', async () => {
        users.create.mockRejectedValue( new QueryFailedError( 'INSERT', [], Object.assign( new Error(), { code: '23502' } ) ) );
        await expect( service.signup( signup, {} ) ).rejects.toThrow( QueryFailedError );

        users.create.mockRejectedValue( new Error( 'connection lost' ) );
        await expect( service.signup( signup, {} ) ).rejects.toThrow( 'connection lost' );
    } );

    it( 'refresh signs a new access token for the session\'s user and returns the rotated refresh token', async () => {
        sessions.rotate.mockResolvedValue( { userId: 'user-1', token: 'rotated' } );
        users.findById.mockResolvedValue( { id: 'user-1', email: 'sam@example.com', platformRole: PlatformRole.ApplicationUser } );

        expect( await service.refresh( 'old', {} ) ).toEqual( { accessToken: 'access-token', refreshToken: 'rotated' } );
    } );

    it( 'logout ends the session of the refresh token', async () => {
        await service.logout( 'token' );

        expect( sessions.revoke ).toHaveBeenCalledWith( 'token' );
    } );
} );
