import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Patch,
    Post,
    Req,
    Res,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiConflictResponse,
    ApiCookieAuth,
    ApiNoContentResponse,
    ApiOperation,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '@studylog/casl';
import {
    ChangePasswordBody,
    DeleteAccountBody,
    LoginBody,
    Responses,
    SignupBody,
    UpdateProfileBody,
} from '@studylog/nestjs';
import type {
    AccessTokenResponse,
    ChangePasswordRequest,
    DeleteAccountRequest,
    LoginRequest,
    SignupRequest,
    UpdateProfileRequest,
    User,
} from '@studylog/schemas';
import type { CookieOptions, Request, Response } from 'express';

import { RateLimit } from '../rate-limits.js';
import { toPublicUser } from '../users/public-user.js';
import { UsersService } from '../users/users.service.js';
import { AccountService } from './account.service.js';
import { AuthGuard, CurrentUser } from './auth.guard.js';
import type { AuthResult } from './auth.service.js';
import { AuthService } from './auth.service.js';
import type { ClientMeta } from './sessions.service.js';

export const REFRESH_COOKIE = 'refresh_token';

@ApiTags( 'auth' )
@Controller( 'auth' )
export class AuthController {
    private readonly cookieOptions: CookieOptions;

    constructor(
        private readonly authService: AuthService,
        private readonly usersService: UsersService,
        private readonly accountService: AccountService,
        config: ConfigService,
    ) {
        this.cookieOptions = {
            httpOnly: true,
            secure: config.getOrThrow<boolean>( 'COOKIE_SECURE' ),
            sameSite: 'strict',
            // Only sent to the auth endpoints, not with every API call.
            path: '/auth',
            maxAge: config.getOrThrow<number>( 'REFRESH_TOKEN_TTL_DAYS' ) * 24 * 60 * 60 * 1000,
        };
    }

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
