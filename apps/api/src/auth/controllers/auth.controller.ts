import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Inject,
    Patch,
    Post,
    Req,
    Res,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiConflictResponse,
    ApiCookieAuth,
    ApiNoContentResponse,
    ApiOperation,
    ApiServiceUnavailableResponse,
    ApiTags,
    ApiTooManyRequestsResponse,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '@studylog/casl';
import {
    ChangeEmailBody,
    ChangePasswordBody,
    DeleteAccountBody,
    ForgotPasswordBody,
    LoginBody,
    ResetPasswordBody,
    Responses,
    SignupBody,
    UpdateProfileBody,
    VerifyEmailBody,
} from '@studylog/nestjs';
import type {
    AccessTokenResponse,
    ChangeEmailRequest,
    ChangePasswordRequest,
    DeleteAccountRequest,
    ForgotPasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
    SignupRequest,
    UpdateProfileRequest,
    User,
    VerifyEmailRequest,
} from '@studylog/schemas';
import type { Request, Response } from 'express';

import { refreshCookieConfig } from '../../config/cookie.config.js';
import { RateLimit } from '../../rate-limits.js';
import { toPublicUser } from '../../users/public-user.js';
import { UsersService } from '../../users/users.service.js';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import { AuthGuard } from '../guards/auth.guard.js';
import { AccountService } from '../services/account.service.js';
import type { AuthResult } from '../services/auth.service.js';
import { AuthService } from '../services/auth.service.js';
import type { ClientMeta } from '../services/sessions.service.js';
import { VerificationService } from '../services/verification.service.js';

export const REFRESH_COOKIE = 'refresh_token';

@ApiTags( 'auth' )
@Controller( 'auth' )
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly usersService: UsersService,
        private readonly accountService: AccountService,
        private readonly verification: VerificationService,
        @Inject( refreshCookieConfig.KEY ) private readonly cookieOptions: ConfigType<typeof refreshCookieConfig>,
    ) {}

    @Post( 'signup' )
    @RateLimit( 'signup' )
    @ApiOperation( { summary: 'Create an account and start a session (sets the refresh cookie)' } )
    @TypeboxResponse( Responses.AuthResponse, { status: 201, description: 'Account created' } )
    @ApiBadRequestResponse( { description: 'Invalid input' } )
    @ApiConflictResponse( { description: 'Email is already registered' } )
    async signup(
        @Body( { schema: SignupBody } ) dto: SignupRequest,
        @Req() req: Request,
        @Res( { passthrough: true } ) res: Response,
    ): Promise<Omit<AuthResult, 'refreshToken'>> {
        return this.withRefreshCookie( res, await this.authService.signup( dto, clientMeta( req ) ) );
    }

    @Post( 'login' )
    @RateLimit( 'login' )
    @HttpCode( HttpStatus.OK )
    @ApiOperation( { summary: 'Log in and start a session (sets the refresh cookie)' } )
    @TypeboxResponse( Responses.AuthResponse, { description: 'Logged in' } )
    @ApiBadRequestResponse( { description: 'Invalid input' } )
    @ApiUnauthorizedResponse( { description: 'Invalid email or password' } )
    async login(
        @Body( { schema: LoginBody } ) dto: LoginRequest,
        @Req() req: Request,
        @Res( { passthrough: true } ) res: Response,
    ): Promise<Omit<AuthResult, 'refreshToken'>> {
        return this.withRefreshCookie( res, await this.authService.login( dto, clientMeta( req ) ) );
    }

    @Post( 'refresh' )
    @RateLimit( 'refresh' )
    @HttpCode( HttpStatus.OK )
    @ApiCookieAuth()
    @ApiOperation( { summary: 'Get a new access token and rotate the refresh cookie' } )
    @TypeboxResponse( Responses.AccessTokenResponse, { description: 'New access token' } )
    @ApiUnauthorizedResponse( { description: 'Missing, expired, revoked or reused refresh token' } )
    async refresh(
        @Req() req: Request,
        @Res( { passthrough: true } ) res: Response,
    ): Promise<AccessTokenResponse> {
        const token = readRefreshCookie( req );

        if ( !token ) {
            throw new UnauthorizedException();
        }
        try {
            const { accessToken, refreshToken } = await this.authService.refresh( token, clientMeta( req ) );

            res.cookie( REFRESH_COOKIE, refreshToken, this.cookieOptions );

            return { accessToken };
        } catch ( err ) {
            if ( err instanceof UnauthorizedException ) {
                this.clearRefreshCookie( res );
            }
            throw err;
        }
    }

    @Post( 'logout' )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiCookieAuth()
    @ApiOperation( { summary: 'End this device\'s session and clear the refresh cookie' } )
    @ApiNoContentResponse( { description: 'Logged out' } )
    async logout( @Req() req: Request, @Res( { passthrough: true } ) res: Response ): Promise<void> {
        const token = readRefreshCookie( req );

        if ( token ) {
            await this.authService.logout( token );
        }
        this.clearRefreshCookie( res );
    }

    @Get( 'me' )
    @UseGuards( AuthGuard )
    @ApiBearerAuth()
    @ApiOperation( { summary: 'Get the logged-in user' } )
    @TypeboxResponse( Responses.User, { description: 'The logged-in user' } )
    @ApiUnauthorizedResponse( { description: 'Missing or invalid access token' } )
    async me( @CurrentUser() current: AccessTokenPayload ): Promise<User> {
        const user = await this.usersService.findById( current.sub );

        if ( !user ) {
            throw new UnauthorizedException();
        }

        return toPublicUser( user );
    }

    @Patch( 'me' )
    @UseGuards( AuthGuard )
    @ApiBearerAuth()
    @ApiOperation( { summary: 'Update your name' } )
    @TypeboxResponse( Responses.User, { description: 'The updated user' } )
    @ApiBadRequestResponse( { description: 'Invalid input' } )
    @ApiUnauthorizedResponse( { description: 'Missing or invalid access token' } )
    updateProfile(
        @CurrentUser() current: AccessTokenPayload,
        @Body( { schema: UpdateProfileBody } ) dto: UpdateProfileRequest,
    ): Promise<User> {
        return this.accountService.updateProfile( current.sub, dto );
    }

    @Post( 'change-password' )
    @RateLimit( 'sensitive' )
    @UseGuards( AuthGuard )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiBearerAuth()
    @ApiOperation( {
        summary: 'Change your password',
        description: 'Signs out every other device (their refresh tokens stop working; access tokens expire within '
            + '15 minutes). This device stays signed in.',
    } )
    @ApiNoContentResponse( { description: 'Password changed' } )
    @ApiBadRequestResponse( { description: 'Invalid input' } )
    @ApiUnauthorizedResponse( { description: 'Wrong current password, or missing/invalid access token' } )
    changePassword(
        @CurrentUser() current: AccessTokenPayload,
        @Body( { schema: ChangePasswordBody } ) dto: ChangePasswordRequest,
        @Req() req: Request,
    ): Promise<void> {
        return this.accountService.changePassword(
            current.sub,
            dto.currentPassword,
            dto.newPassword,
            readRefreshCookie( req ),
        );
    }

    @Post( 'verify-email' )
    @RateLimit( 'code' )
    @UseGuards( AuthGuard )
    @HttpCode( HttpStatus.OK )
    @ApiBearerAuth()
    @ApiOperation( { summary: 'Verify your email with the 6-digit code emailed to you' } )
    @TypeboxResponse( Responses.User, { description: 'Verified; the user with emailVerifiedAt set' } )
    @ApiBadRequestResponse( { description: 'Wrong or expired code (after 5 wrong codes it stops working)' } )
    @ApiUnauthorizedResponse( { description: 'Missing or invalid access token' } )
    verifyEmail(
        @CurrentUser() current: AccessTokenPayload,
        @Body( { schema: VerifyEmailBody } ) dto: VerifyEmailRequest,
    ): Promise<User> {
        return this.verification.verify( current.sub, dto.code );
    }

    @Post( 'verify-email/resend' )
    @RateLimit( 'sensitive' )
    @UseGuards( AuthGuard )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiBearerAuth()
    @ApiOperation( { summary: 'Email a new verification code (the old one stops working)' } )
    @ApiNoContentResponse( { description: 'Sent' } )
    @ApiConflictResponse( { description: 'Your email is already verified' } )
    @ApiTooManyRequestsResponse( { description: 'The last code was sent less than a minute ago' } )
    @ApiServiceUnavailableResponse( { description: 'The email couldn\'t be sent; try again later' } )
    resendVerification( @CurrentUser() current: AccessTokenPayload ): Promise<void> {
        return this.verification.resend( current.sub );
    }

    @Post( 'forgot-password' )
    @RateLimit( 'sensitive' )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiOperation( {
        summary: 'Email a code to reset a forgotten password',
        description: 'Answers the same whether or not the email has an account, so it can\'t be used to find out.',
    } )
    @ApiNoContentResponse( { description: 'If the email has an account, a code is on its way' } )
    @ApiBadRequestResponse( { description: 'Invalid input' } )
    forgotPassword( @Body( { schema: ForgotPasswordBody } ) dto: ForgotPasswordRequest ): Promise<void> {
        return this.verification.forgotPassword( dto.email );
    }

    @Post( 'reset-password' )
    @RateLimit( 'code' )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiOperation( {
        summary: 'Choose a new password with the emailed code',
        description: 'Signs out every device; log in again with the new password. Also verifies the email.',
    } )
    @ApiNoContentResponse( { description: 'Password changed' } )
    @ApiBadRequestResponse( { description: 'Invalid input, or a wrong or expired code' } )
    resetPassword( @Body( { schema: ResetPasswordBody } ) dto: ResetPasswordRequest ): Promise<void> {
        return this.verification.resetPassword( dto.email, dto.code, dto.newPassword );
    }

    @Post( 'change-email' )
    @RateLimit( 'sensitive' )
    @UseGuards( AuthGuard )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiBearerAuth()
    @ApiOperation( {
        summary: 'Start changing your email: emails a code to the new address',
        description: 'Nothing changes until the code is entered at POST /auth/change-email/confirm. Asking again '
            + 'sends a new code and replaces the pending address.',
    } )
    @ApiNoContentResponse( { description: 'A code is on its way to the new address' } )
    @ApiBadRequestResponse( { description: 'Invalid input, or that is already your email' } )
    @ApiUnauthorizedResponse( { description: 'Wrong password, or missing/invalid access token' } )
    @ApiConflictResponse( { description: 'That email is already used by another account' } )
    @ApiTooManyRequestsResponse( { description: 'The last code was sent less than a minute ago' } )
    @ApiServiceUnavailableResponse( { description: 'The email couldn\'t be sent; try again later' } )
    changeEmail(
        @CurrentUser() current: AccessTokenPayload,
        @Body( { schema: ChangeEmailBody } ) dto: ChangeEmailRequest,
    ): Promise<void> {
        return this.verification.requestEmailChange( current.sub, dto.newEmail, dto.password );
    }

    @Post( 'change-email/confirm' )
    @RateLimit( 'code' )
    @UseGuards( AuthGuard )
    @HttpCode( HttpStatus.OK )
    @ApiBearerAuth()
    @ApiOperation( {
        summary: 'Switch to the new email with the code sent to it',
        description: 'The new address counts as verified. A notice goes to the old address.',
    } )
    @TypeboxResponse( Responses.User, { description: 'The user with the new email' } )
    @ApiBadRequestResponse( { description: 'Wrong or expired code (after 5 wrong codes it stops working)' } )
    @ApiUnauthorizedResponse( { description: 'Missing or invalid access token' } )
    @ApiConflictResponse( { description: 'Someone signed up with that email in the meantime' } )
    confirmEmailChange(
        @CurrentUser() current: AccessTokenPayload,
        @Body( { schema: VerifyEmailBody } ) dto: VerifyEmailRequest,
    ): Promise<User> {
        return this.verification.confirmEmailChange( current.sub, dto.code );
    }

    @Post( 'delete-account' )
    @RateLimit( 'sensitive' )
    @UseGuards( AuthGuard )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiBearerAuth()
    @ApiOperation( {
        summary: 'Delete your account',
        description: 'Deletes your personal workspace (your own paths and items), organizations where you are the only '
            + 'member, your enrollments, progress and study sessions. Refused while you are the only owner of an '
            + 'organization with other members.',
    } )
    @ApiNoContentResponse( { description: 'Account deleted; the refresh cookie is cleared' } )
    @ApiUnauthorizedResponse( { description: 'Wrong password, or missing/invalid access token' } )
    @ApiConflictResponse( { description: 'You are the only owner of an organization with other members' } )
    async deleteAccount(
        @CurrentUser() current: AccessTokenPayload,
        @Body( { schema: DeleteAccountBody } ) dto: DeleteAccountRequest,
        @Res( { passthrough: true } ) res: Response,
    ): Promise<void> {
        await this.accountService.deleteAccount( current.sub, dto.password );
        this.clearRefreshCookie( res );
    }

    private withRefreshCookie( res: Response, result: AuthResult ): Omit<AuthResult, 'refreshToken'> {
        const { refreshToken, ...body } = result;

        res.cookie( REFRESH_COOKIE, refreshToken, this.cookieOptions );

        return body;
    }

    private clearRefreshCookie( res: Response ): void {
        const { maxAge: _, ...options } = this.cookieOptions;

        res.clearCookie( REFRESH_COOKIE, options );
    }
}

function readRefreshCookie( req: Request ): string | undefined {
    const value: unknown = req.cookies?.[REFRESH_COOKIE];

    return typeof value === 'string' && value ? value : undefined;
}

function clientMeta( req: Request ): ClientMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
}
