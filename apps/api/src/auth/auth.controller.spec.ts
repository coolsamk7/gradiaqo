import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { httpContext, paramDecoratorFactory } from '../../test/unit/param-decorator.js';
import type { UsersService } from '../users/users.service.js';
import type { AccountService } from './account.service.js';
import { AuthController, REFRESH_COOKIE } from './auth.controller.js';
import { CurrentUser } from './auth.guard.js';
import type { AuthService } from './auth.service.js';
import type { VerificationService } from './verification.service.js';

/*
 * The controller's own job: moving the refresh token between the response body and an httpOnly cookie.
 */

const config = {
    getOrThrow: ( key: string ) =>
        ( { COOKIE_SECURE: true, REFRESH_TOKEN_TTL_DAYS: 180 } as Record<string, unknown> )[key],
} as unknown as ConfigService;

describe( 'AuthController cookies', () => {
    const auth = { signup: vi.fn(), login: vi.fn(), refresh: vi.fn(), logout: vi.fn() };
    const users = { findById: vi.fn() };
    const account = { updateProfile: vi.fn(), changePassword: vi.fn(), deleteAccount: vi.fn() };
    const verification = {
        verify: vi.fn(),
        resend: vi.fn(),
        forgotPassword: vi.fn(),
        resetPassword: vi.fn(),
        requestEmailChange: vi.fn(),
        confirmEmailChange: vi.fn(),
    };
    const controller = new AuthController(
        auth as unknown as AuthService,
        users as unknown as UsersService,
        account as unknown as AccountService,
        verification as unknown as VerificationService,
        config,
    );
    const response = () => ( { cookie: vi.fn(), clearCookie: vi.fn() } );
    const request = ( cookie?: string ) => ( { cookies: cookie ? { [REFRESH_COOKIE]: cookie } : {}, headers: {}, ip: '1.2.3.4' } ) as unknown as Request;

    beforeEach( () => {
        vi.clearAllMocks();
    } );

    it( 'login sets the refresh token as a secure httpOnly cookie scoped to /auth, and keeps it out of the body', async () => {
        auth.login.mockResolvedValue( { accessToken: 'access', refreshToken: 'refresh', user: { id: 'u' } } );
        const res = response();

        const body = await controller.login( { email: 'a@b.co', password: 'x' }, request(), res as unknown as Response );

        expect( body ).toEqual( { accessToken: 'access', user: { id: 'u' } } );
        expect( res.cookie ).toHaveBeenCalledWith( REFRESH_COOKIE, 'refresh', {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            path: '/auth',
            maxAge: 180 * 24 * 60 * 60 * 1000,
        } );
    } );

    describe( 'refresh', () => {
        it( 'needs the cookie', async () => {
            await expect( controller.refresh( request(), response() as unknown as Response ) )
                .rejects.toThrow( UnauthorizedException );
            expect( auth.refresh ).not.toHaveBeenCalled();
        } );

        it( 'rotates the cookie', async () => {
            auth.refresh.mockResolvedValue( { accessToken: 'new-access', refreshToken: 'new-refresh' } );
            const res = response();

            expect( await controller.refresh( request( 'old' ), res as unknown as Response ) ).toEqual( { accessToken: 'new-access' } );
            expect( res.cookie ).toHaveBeenCalledWith( REFRESH_COOKIE, 'new-refresh', expect.any( Object ) );
        } );

        it( 'keeps the cookie when refreshing fails for another reason (e.g. the database is down)', async () => {
            auth.refresh.mockRejectedValue( new InternalServerErrorException() );
            const res = response();

            await expect( controller.refresh( request( 'fine' ), res as unknown as Response ) ).rejects.toThrow( InternalServerErrorException );
            expect( res.clearCookie ).not.toHaveBeenCalled();
        } );

        it( 'clears a cookie that no longer works', async () => {
            auth.refresh.mockRejectedValue( new UnauthorizedException() );
            const res = response();

            await expect( controller.refresh( request( 'stolen' ), res as unknown as Response ) ).rejects.toThrow( UnauthorizedException );
            expect( res.clearCookie ).toHaveBeenCalledWith( REFRESH_COOKIE, expect.objectContaining( { path: '/auth' } ) );
        } );
    } );

    it( 'logout ends the session and clears the cookie, even without one', async () => {
        const res = response();

        await controller.logout( request( 'current' ), res as unknown as Response );
        expect( auth.logout ).toHaveBeenCalledWith( 'current' );

        await controller.logout( request(), res as unknown as Response );
        expect( auth.logout ).toHaveBeenCalledOnce();
        expect( res.clearCookie ).toHaveBeenCalledTimes( 2 );
    } );

    it( 'signup passes the client\'s user agent and IP to the session and sets the cookie', async () => {
        auth.signup.mockResolvedValue( { accessToken: 'a', refreshToken: 'r', user: { id: 'u' } } );
        const res = response();
        const req = { ...request(), headers: { 'user-agent': 'Firefox' } } as unknown as Request;

        await controller.signup( { email: 'a@b.co', firstName: 'A', lastName: 'B', password: 'supersecret1' }, req, res as unknown as Response );

        expect( auth.signup ).toHaveBeenCalledWith( expect.any( Object ), { userAgent: 'Firefox', ip: '1.2.3.4' } );
        expect( res.cookie ).toHaveBeenCalledWith( REFRESH_COOKIE, 'r', expect.any( Object ) );
    } );

    it( 'me returns the user without the password hash, or 401 if the account is gone', async () => {
        users.findById.mockResolvedValue( { id: 'me', passwordHash: 'secret' } );
        expect( await controller.me( { sub: 'me' } as never ) ).toEqual( { id: 'me' } );

        users.findById.mockResolvedValue( null );
        await expect( controller.me( { sub: 'me' } as never ) ).rejects.toThrow( UnauthorizedException );
    } );

    it( 'account routes act for the logged-in user; changing the password keeps this device\'s session', async () => {
        await controller.updateProfile( { sub: 'me' } as never, { firstName: 'New' } );
        await controller.changePassword( { sub: 'me' } as never, { currentPassword: 'old', newPassword: 'newpassword' }, request( 'this-device' ) );

        expect( account.updateProfile ).toHaveBeenCalledWith( 'me', { firstName: 'New' } );
        expect( account.changePassword ).toHaveBeenCalledWith( 'me', 'old', 'newpassword', 'this-device' );
    } );

    it( 'email code routes pass the code, email and new password on', async () => {
        verification.verify.mockResolvedValue( { id: 'me' } );

        expect( await controller.verifyEmail( { sub: 'me' } as never, { code: '482913' } ) ).toEqual( { id: 'me' } );
        await controller.resendVerification( { sub: 'me' } as never );
        await controller.forgotPassword( { email: 'a@b.co' } );
        await controller.resetPassword( { email: 'a@b.co', code: '482913', newPassword: 'newpassword' } );

        expect( verification.verify ).toHaveBeenCalledWith( 'me', '482913' );
        expect( verification.resend ).toHaveBeenCalledWith( 'me' );
        expect( verification.forgotPassword ).toHaveBeenCalledWith( 'a@b.co' );
        expect( verification.resetPassword ).toHaveBeenCalledWith( 'a@b.co', '482913', 'newpassword' );
    } );

    it( 'change email routes pass the new email, password and code on', async () => {
        verification.confirmEmailChange.mockResolvedValue( { id: 'me', email: 'new@b.co' } );

        await controller.changeEmail( { sub: 'me' } as never, { newEmail: 'new@b.co', password: 'right' } );
        expect( await controller.confirmEmailChange( { sub: 'me' } as never, { code: '482913' } ) ).toEqual( { id: 'me', email: 'new@b.co' } );

        expect( verification.requestEmailChange ).toHaveBeenCalledWith( 'me', 'new@b.co', 'right' );
        expect( verification.confirmEmailChange ).toHaveBeenCalledWith( 'me', '482913' );
    } );

    it( 'deleting the account clears the refresh cookie', async () => {
        const res = response();

        await controller.deleteAccount( { sub: 'me' } as never, { password: 'right' }, res as unknown as Response );

        expect( account.deleteAccount ).toHaveBeenCalledWith( 'me', 'right' );
        expect( res.clearCookie ).toHaveBeenCalledWith( REFRESH_COOKIE, expect.any( Object ) );
    } );

    it( '@CurrentUser() is the token payload the auth guard attached', () => {
        const payload = { sub: 'me' };

        expect( paramDecoratorFactory( CurrentUser )( undefined, httpContext( { user: payload } ) ) ).toBe( payload );
    } );
} );
