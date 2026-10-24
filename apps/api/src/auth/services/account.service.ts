import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Organization } from '@studylog/database';
import { Membership, OrganizationRole, User } from '@studylog/database';
import type { UpdateProfileRequest } from '@studylog/schemas';
import * as argon2 from 'argon2';
import { DataSource, Not } from 'typeorm';

import type { PublicUser } from '../../users/public-user.js';
import { toPublicUser } from '../../users/public-user.js';
import { UsersService } from '../../users/services/users.service.js';
import { SessionsService } from './sessions.service.js';

/** The logged-in user managing their own account. Changing the email is in VerificationService (it needs a code). */
@Injectable()
export class AccountService {
    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly usersService: UsersService,
        private readonly sessionsService: SessionsService,
    ) {}

    async updateProfile( userId: string, dto: UpdateProfileRequest ): Promise<PublicUser> {
        await this.dataSource.getRepository( User ).update( { id: userId }, dto );

        return toPublicUser( await this.usersService.findByIdOrFail( userId ) );
    }

    /** Changes the password and signs out every other device; `currentRefreshToken` keeps this one signed in. */
    async changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string,
        currentRefreshToken: string | undefined,
    ): Promise<void> {
        await this.verifyPassword( userId, currentPassword );
        const passwordHash = await argon2.hash( newPassword );

        await this.dataSource.getRepository( User ).update( { id: userId }, { passwordHash } );
        await this.sessionsService.revokeOthers( userId, currentRefreshToken );
    }

    /**
     * Deletes the account with the user's personal workspace (their own paths and items) and any organization
     * they're alone in. Refused while they're the only owner of an organization that has other members, so
     * nobody is left in an organization without an owner.
     */
    async deleteAccount( userId: string, password: string ): Promise<void> {
        await this.verifyPassword( userId, password );
        await this.dataSource.transaction( async ( manager ) => {
            const owned = await manager.find( Membership, {
                where: { userId, role: OrganizationRole.Owner },
                relations: { organization: true },
            } );
            const toDelete: Organization[] = [];
            const blocking: string[] = [];

            for ( const { organization, organizationId } of owned ) {
                const others = { organizationId, userId: Not( userId ) };

                if ( organization.isPersonal || !( await manager.existsBy( Membership, others ) ) ) {
                    toDelete.push( organization );
                } else if ( !( await manager.existsBy( Membership, { ...others, role: OrganizationRole.Owner } ) ) ) {
                    blocking.push( organization.name );
                }
            }
            if ( blocking.length > 0 ) {
                throw new ConflictException(
                    `You're the only owner of ${blocking.map( ( name ) => `"${name}"` ).join( ', ' )}: `
                    + 'make someone else owner, or delete it, first',
                );
            }

            await manager.remove( toDelete );
            // Sessions, memberships, enrollments, progress and study sessions go with the user.
            await manager.delete( User, { id: userId } );
        } );
    }

    private async verifyPassword( userId: string, password: string ): Promise<void> {
        const user = await this.usersService.findByIdWithPassword( userId );

        if ( !user || !( await argon2.verify( user.passwordHash, password ) ) ) {
            throw new UnauthorizedException( 'Wrong password' );
        }
    }
}
