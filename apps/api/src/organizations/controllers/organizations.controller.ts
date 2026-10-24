import { subject } from '@casl/ability';
import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiConflictResponse,
    ApiNoContentResponse,
    ApiOperation,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AccessTokenPayload, AppAbility, OrganizationContext } from '@studylog/casl';
import { CheckAbilities, CurrentAbility, CurrentOrganization } from '@studylog/casl';
import { OrganizationRole, PlatformRole } from '@studylog/database';
import { CreateOrganizationBody, Responses, UpdateMemberBody, UpdateOrganizationBody } from '@studylog/nestjs';
import type {
    CreateOrganizationRequest,
    Member,
    MyOrganization,
    OrganizationSummary,
    UpdateMemberRequest,
    UpdateOrganizationRequest,
} from '@studylog/schemas';

import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { AuthGuard } from '../../auth/guards/auth.guard.js';
import { OrganizationAuth } from '../decorators/organization-auth.decorator.js';
import { assertShared, OrganizationsService, toOrganizationResponse } from '../services/organizations.service.js';

@ApiTags( 'organizations' )
@Controller( 'organizations' )
export class OrganizationsController {
    constructor( private readonly organizationsService: OrganizationsService ) {}

    @Get()
    @UseGuards( AuthGuard )
    @ApiBearerAuth()
    @ApiOperation( {
        summary: 'List the organizations you belong to',
        description: 'With your role, member and published path counts, and the first few members (for avatars).',
    } )
    @TypeboxResponse( Responses.OrganizationSummaryList )
    @ApiUnauthorizedResponse( { description: 'Missing or invalid access token' } )
    listMine( @CurrentUser() user: AccessTokenPayload ): Promise<OrganizationSummary[]> {
        return this.organizationsService.summariesForUser( user.sub );
    }

    @Post()
    @UseGuards( AuthGuard )
    @ApiBearerAuth()
    @ApiOperation( { summary: 'Create an organization (e.g. a study group); you become its owner' } )
    @TypeboxResponse( Responses.MyOrganization, { status: 201 } )
    @ApiBadRequestResponse( { description: 'Invalid input' } )
    @ApiUnauthorizedResponse( { description: 'Missing or invalid access token' } )
    create(
        @CurrentUser() user: AccessTokenPayload,
        @Body( { schema: CreateOrganizationBody } ) dto: CreateOrganizationRequest,
    ): Promise<MyOrganization> {
        return this.organizationsService.create( user.sub, dto.name );
    }

    @Get( ':organizationId' )
    @OrganizationAuth()
    @CheckAbilities( [ 'read', 'Organization' ] )
    @ApiOperation( { summary: 'Get one organization' } )
    @TypeboxResponse( Responses.MyOrganization )
    async findOne( @CurrentOrganization() context: OrganizationContext ): Promise<MyOrganization> {
        const organization = await this.organizationsService.findById( context.organizationId );

        if ( !organization ) {
            throw new NotFoundException( 'Organization not found' );
        }

        return { ...toOrganizationResponse( organization ), role: context.role };
    }

    @Patch( ':organizationId' )
    @OrganizationAuth()
    @CheckAbilities( [ 'update', 'Organization' ] )
    @ApiOperation( { summary: 'Rename an organization (owner or admin)' } )
    @TypeboxResponse( Responses.MyOrganization )
    @ApiBadRequestResponse( { description: 'Invalid input' } )
    async update(
        @CurrentOrganization() context: OrganizationContext,
        @CurrentAbility() ability: AppAbility,
        @Body( { schema: UpdateOrganizationBody } ) dto: UpdateOrganizationRequest,
    ): Promise<MyOrganization> {
        const organization = await this.organizationsService.findById( context.organizationId );

        if ( !organization ) {
            throw new NotFoundException( 'Organization not found' );
        }
        // Record-level check: the route check only says "can update some organization".
        if ( !ability.can( 'update', organization ) ) {
            throw new ForbiddenException();
        }

        const updated = await this.organizationsService.rename( organization, dto.name );

        return { ...toOrganizationResponse( updated ), role: context.role };
    }

    @Get( ':organizationId/members' )
    @OrganizationAuth()
    @CheckAbilities( [ 'read', 'Membership' ] )
    @ApiOperation( { summary: 'List the members of an organization' } )
    @TypeboxResponse( Responses.MemberList )
    listMembers( @CurrentOrganization() context: OrganizationContext ): Promise<Member[]> {
        return this.organizationsService.listMembers( context.organizationId );
    }

    @Delete( ':organizationId' )
    @OrganizationAuth()
    @CheckAbilities( [ 'delete', 'Organization' ] )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiOperation( { summary: 'Delete an organization with its paths, items and memberships (owner only)' } )
    @ApiNoContentResponse( { description: 'Deleted' } )
    @ApiBadRequestResponse( { description: 'Personal workspaces can\'t be deleted' } )
    async remove(
        @CurrentOrganization() context: OrganizationContext,
        @CurrentAbility() ability: AppAbility,
    ): Promise<void> {
        const organization = await this.findOrFail( context.organizationId );

        assertShared( organization );
        if ( !ability.can( 'delete', organization ) ) {
            throw new ForbiddenException();
        }
        await this.organizationsService.remove( organization );
    }

    @Patch( ':organizationId/members/:userId' )
    @OrganizationAuth()
    @CheckAbilities( [ 'update', 'Membership' ] )
    @ApiOperation( {
        summary: 'Change a member\'s role',
        description: 'Owners can change anyone and make others owner. Admins can change members and admins. '
            + 'The last owner can\'t be demoted.',
    } )
    @TypeboxResponse( Responses.Member )
    @ApiBadRequestResponse( { description: 'Invalid input, or a personal workspace' } )
    @ApiConflictResponse( { description: 'Would leave the organization without an owner' } )
    async changeRole(
        @CurrentUser() user: AccessTokenPayload,
        @CurrentOrganization() context: OrganizationContext,
        @CurrentAbility() ability: AppAbility,
        @Param( 'userId', ParseUUIDPipe ) userId: string,
        @Body( { schema: UpdateMemberBody } ) dto: UpdateMemberRequest,
    ): Promise<Member> {
        assertShared( await this.findOrFail( context.organizationId ) );

        const membership = await this.findMemberOrFail( context.organizationId, userId );
        const isOwner = context.role === OrganizationRole.Owner || user.platformRole === PlatformRole.Superadmin;

        // Admins can't touch owners (CASL rule), and only owners can hand out ownership.
        if ( !ability.can( 'update', membership ) || ( dto.role === OrganizationRole.Owner && !isOwner ) ) {
            throw new ForbiddenException();
        }

        return this.organizationsService.changeRole( context.organizationId, userId, dto.role );
    }

    @Delete( ':organizationId/members/:userId' )
    @OrganizationAuth()
    @CheckAbilities( [ 'delete', 'Membership' ] )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiOperation( { summary: 'Remove a member (owners: anyone; admins: members and admins)' } )
    @ApiNoContentResponse( { description: 'Removed' } )
    @ApiBadRequestResponse( { description: 'A personal workspace' } )
    @ApiConflictResponse( { description: 'The last owner can\'t be removed' } )
    async removeMember(
        @CurrentOrganization() context: OrganizationContext,
        @CurrentAbility() ability: AppAbility,
        @Param( 'userId', ParseUUIDPipe ) userId: string,
    ): Promise<void> {
        assertShared( await this.findOrFail( context.organizationId ) );

        const membership = await this.findMemberOrFail( context.organizationId, userId );

        if ( !ability.can( 'delete', membership ) ) {
            throw new ForbiddenException();
        }
        await this.organizationsService.removeMember( context.organizationId, userId );
    }

    @Post( ':organizationId/leave' )
    @OrganizationAuth()
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiOperation( { summary: 'Leave an organization' } )
    @ApiNoContentResponse( { description: 'Left' } )
    @ApiBadRequestResponse( { description: 'You can\'t leave your personal workspace' } )
    @ApiConflictResponse( { description: 'The last owner can\'t leave' } )
    async leave(
        @CurrentUser() user: AccessTokenPayload,
        @CurrentOrganization() context: OrganizationContext,
    ): Promise<void> {
        assertShared( await this.findOrFail( context.organizationId ) );
        if ( context.role === null ) {
            throw new NotFoundException( 'You are not a member of this organization' );
        }
        await this.organizationsService.removeMember( context.organizationId, user.sub );
    }

    private async findOrFail( id: string ) {
        const organization = await this.organizationsService.findById( id );

        if ( !organization ) {
            throw new NotFoundException( 'Organization not found' );
        }

        return organization;
    }

    /** The membership as a CASL subject, for record-level checks. */
    private async findMemberOrFail( organizationId: string, userId: string ) {
        const membership = await this.organizationsService.findMember( organizationId, userId );

        if ( !membership ) {
            throw new NotFoundException( 'Member not found' );
        }

        return subject( 'Membership', membership );
    }
}
