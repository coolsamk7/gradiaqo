import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { PlatformRole, User } from '@studylog/database';
import type { AdminUser, AdminUserPage, ListUsersQuery } from '@studylog/schemas';
import { DataSource } from 'typeorm';

import { AccountService } from '../../auth/services/account.service.js';
import { toPublicUser } from '../../users/public-user.js';

/** Superadmins finding accounts, promoting or demoting superadmins, and removing accounts. */
@Injectable()
export class AdminUsersService {
    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly accountService: AccountService,
    ) {}

    /** Newest accounts first. `search` matches part of the email or the full name. */
    async list( { search, role, verified, limit = 50, offset = 0 }: ListUsersQuery ): Promise<AdminUserPage> {
        const query = this.dataSource.getRepository( User )
            .createQueryBuilder( 'user' )
            .orderBy( 'user.createdAt', 'DESC' )
            .addOrderBy( 'user.id', 'ASC' )
            .take( limit )
            .skip( offset );

        if ( search ) {
            // Match the text literally: % and _ are wildcards in ILIKE.
            query.andWhere(
                `( user.email ILIKE :search OR CONCAT( user.firstName, ' ', user.lastName ) ILIKE :search )`,
                { search: `%${search.trim().replace( /[\\%_]/g, '\\$&' )}%` },
            );
        }
        if ( role ) {
            query.andWhere( 'user.platformRole = :role', { role } );
        }
        if ( verified !== undefined ) {
            query.andWhere( verified ? 'user.emailVerifiedAt IS NOT NULL' : 'user.emailVerifiedAt IS NULL' );
        }

        const [ users, total ] = await query.getManyAndCount();

        return { items: users.map( toPublicUser ), total };
    }

    /** Promotes or demotes another user. Never yourself, so there is always a superadmin left. */
    async setRole( adminId: string, userId: string, platformRole: PlatformRole ): Promise<AdminUser> {
        if ( userId === adminId ) {
            throw new BadRequestException( 'You can\'t change your own role' );
        }

        const user = await this.find( userId );

        if ( user.platformRole !== platformRole ) {
            await this.dataSource.getRepository( User ).update( { id: userId }, { platformRole } );
            user.platformRole = platformRole;
        }

        return toPublicUser( user );
    }

    /**
     * Removes an account like the user deleting it themselves (see AccountService.removeAccount). Not yourself
     * (Settings does that) and not another superadmin: demote them first, so it's never one click.
     */
    async remove( adminId: string, userId: string ): Promise<void> {
        if ( userId === adminId ) {
            throw new BadRequestException( 'Delete your own account from Settings' );
        }

        const user = await this.find( userId );

        if ( user.platformRole === PlatformRole.Superadmin ) {
            throw new ConflictException( 'Make them a normal user first: superadmins can\'t be removed' );
        }

        await this.accountService.removeAccount(
            userId,
            ( organizations ) => `They're the only owner of ${organizations}, which has other members: someone else has to become owner first`,
        );
    }

    private async find( id: string ): Promise<User> {
        const user = await this.dataSource.getRepository( User ).findOneBy( { id } );

        if ( !user ) {
            throw new NotFoundException( 'User not found' );
        }

        return user;
    }
}
