import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload } from '@studylog/casl';
import type { User } from '@studylog/database';
import { PlatformRole } from '@studylog/database';
import type { LoginRequest, SignupRequest } from '@studylog/schemas';
import * as argon2 from 'argon2';
import { DataSource, QueryFailedError } from 'typeorm';

import { OrganizationsService } from '../organizations/organizations.service.js';
import type { PublicUser } from '../users/public-user.js';
import { toPublicUser } from '../users/public-user.js';
import { UsersService } from '../users/users.service.js';
import type { ClientMeta } from './sessions.service.js';
import { SessionsService } from './sessions.service.js';
import { VerificationService } from './verification.service.js';

export interface AuthResponse {
    accessToken: string;
    user: PublicUser;
}

/** AuthResponse plus the refresh token, which the controller moves into a cookie. */
export interface AuthResult extends AuthResponse {
    refreshToken: string;
}

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly sessionsService: SessionsService,
        private readonly organizationsService: OrganizationsService,
        private readonly dataSource: DataSource,
        private readonly verification: VerificationService,
    ) {}

    async signup( dto: SignupRequest, meta: ClientMeta ): Promise<AuthResult> {
        if ( await this.usersService.existsByEmail( dto.email ) ) {
            throw new ConflictException( 'Email is already registered' );
        }

        const passwordHash = await argon2.hash( dto.password );

        let user: User;

        try {
            // User + personal workspace + owner membership: all or nothing.
            user = await this.dataSource.transaction( async ( manager ) => {
                const created = await this.usersService.create(
                    {
                        email: dto.email,
                        firstName: dto.firstName,
                        lastName: dto.lastName,
                        passwordHash,
                        platformRole: PlatformRole.ApplicationUser,
                    },
                    manager,
                );

                await this.organizationsService.createPersonal( created, manager );

                return created;
            } );
        } catch ( err ) {
            // Two signups with the same email at the same moment: the unique index catches it.
            if (
                err instanceof QueryFailedError
                && ( err.driverError as { code?: string } ).code === PG_UNIQUE_VIOLATION
            ) {
                throw new ConflictException( 'Email is already registered' );
            }
            throw err;
        }

        await this.verification.welcome( user );

        return this.startSession( user, meta );
    }

    async login( dto: LoginRequest, meta: ClientMeta ): Promise<AuthResult> {
        const user = await this.usersService.findByEmailWithPassword( dto.email );

        // Same message for unknown email and wrong password, so emails can't be probed.
        if ( !user || !( await argon2.verify( user.passwordHash, dto.password ) ) ) {
            throw new UnauthorizedException( 'Invalid email or password' );
        }

        return this.startSession( user, meta );
    }

    async refresh(
        refreshToken: string,
        meta: ClientMeta,
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const session = await this.sessionsService.rotate( refreshToken, meta );
        const user = await this.usersService.findById( session.userId );

        if ( !user ) {
            throw new UnauthorizedException();
        }

        return {
            accessToken: await this.signAccessToken( user ),
            refreshToken: session.token,
        };
    }

    logout( refreshToken: string ): Promise<void> {
        return this.sessionsService.revoke( refreshToken );
    }

    private async startSession( user: User, meta: ClientMeta ): Promise<AuthResult> {
        return {
            accessToken: await this.signAccessToken( user ),
            refreshToken: await this.sessionsService.create( user.id, meta ),
            user: toPublicUser( user ),
        };
    }

    private signAccessToken( user: User ): Promise<string> {
        const payload: AccessTokenPayload = { sub: user.id, email: user.email, platformRole: user.platformRole };

        return this.jwtService.signAsync( payload );
    }
}
