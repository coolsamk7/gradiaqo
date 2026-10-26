import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiConflictResponse,
    ApiNoContentResponse,
    ApiNotFoundResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '@studylog/casl';
import { CheckAbilities } from '@studylog/casl';
import { ListUsersQueryParams, Responses, UpdateUserRoleBody } from '@studylog/nestjs';
import type { AdminUser, AdminUserPage, ListUsersQuery, UpdateUserRoleRequest } from '@studylog/schemas';

import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { PlatformAuth } from '../../auth/decorators/platform-auth.decorator.js';
import { AdminUsersService } from '../services/admin-users.service.js';

@ApiTags( 'users (admin)' )
@Controller( 'admin/users' )
@PlatformAuth()
@CheckAbilities( [ 'manage', 'User' ] )
export class AdminUsersController {
    constructor( private readonly adminUsers: AdminUsersService ) {}

    @Get()
    @ApiOperation( { summary: 'Find accounts, newest first: by email or name, role, and whether the email is verified' } )
    @TypeboxResponse( Responses.AdminUserPage )
    @ApiBadRequestResponse( { description: 'Invalid filters' } )
    list( @Query( { schema: ListUsersQueryParams } ) query: ListUsersQuery ): Promise<AdminUserPage> {
        return this.adminUsers.list( query );
    }

    @Patch( ':userId' )
    @ApiOperation( {
        summary: 'Promote a user to superadmin, or make a superadmin a normal user again',
        description: 'Applies when their access token is next renewed (within JWT_EXPIRES_IN_SECONDS) or they log in.',
    } )
    @TypeboxResponse( Responses.AdminUser )
    @ApiBadRequestResponse( { description: 'Invalid role, or your own account' } )
    @ApiNotFoundResponse( { description: 'User not found' } )
    setRole(
        @CurrentUser() admin: AccessTokenPayload,
        @Param( 'userId', ParseUUIDPipe ) userId: string,
        @Body( { schema: UpdateUserRoleBody } ) dto: UpdateUserRoleRequest,
    ): Promise<AdminUser> {
        return this.adminUsers.setRole( admin.sub, userId, dto.platformRole );
    }

    @Delete( ':userId' )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiOperation( {
        summary: 'Remove an account',
        description: 'Like the user deleting it themselves: their personal workspace, organizations they\'re alone '
            + 'in, enrollments, progress and study sessions go too.',
    } )
    @ApiNoContentResponse( { description: 'Account removed' } )
    @ApiBadRequestResponse( { description: 'Your own account (delete it from Settings)' } )
    @ApiNotFoundResponse( { description: 'User not found' } )
    @ApiConflictResponse( { description: 'A superadmin, or the only owner of an organization with other members' } )
    remove( @CurrentUser() admin: AccessTokenPayload, @Param( 'userId', ParseUUIDPipe ) userId: string ): Promise<void> {
        return this.adminUsers.remove( admin.sub, userId );
    }
}
