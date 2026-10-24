import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiConflictResponse,
    ApiNoContentResponse,
    ApiNotFoundResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import type { AccessTokenPayload, OrganizationContext } from '@studylog/casl';
import { CheckAbilities, CurrentOrganization } from '@studylog/casl';
import { CreateInvitationBody, Responses } from '@studylog/nestjs';
import type { CreateInvitationRequest, Invitation, MyInvitation, MyOrganization } from '@studylog/schemas';

import { Authenticated } from '../auth/decorators/authenticated.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RateLimit } from '../rate-limits.js';
import { UsersService } from '../users/users.service.js';
import { InvitationsService } from './invitations.service.js';
import { OrganizationAuth } from './organization-auth.decorator.js';
import { assertShared, OrganizationsService } from './organizations.service.js';

/** An organization's pending invitations, managed by its owners and admins. */
@ApiTags( 'organizations' )
@Controller( 'organizations/:organizationId/invitations' )
@OrganizationAuth()
@CheckAbilities( [ 'create', 'Membership' ] )
export class OrganizationInvitationsController {
    constructor(
        private readonly invitationsService: InvitationsService,
        private readonly organizationsService: OrganizationsService,
    ) {}

    @Get()
    @ApiOperation( { summary: 'Pending invitations (owners and admins)' } )
    @TypeboxResponse( Responses.InvitationList )
    list( @CurrentOrganization() context: OrganizationContext ): Promise<Invitation[]> {
        return this.invitationsService.list( context.organizationId );
    }

    @Post()
    @RateLimit( 'invite' )
    @ApiOperation( {
        summary: 'Invite someone by email (owners and admins)',
        description: 'Emails them a link to StudyLog; they see it under /me/invitations once logged in with that '
            + 'email, for 14 days. Inviting the same email again updates the role, restarts the 14 days and emails '
            + 'them again. If the email can\'t be sent, the invitation is still made.',
    } )
    @TypeboxResponse( Responses.Invitation, { status: 201 } )
    @ApiBadRequestResponse( { description: 'Invalid input, or a personal workspace' } )
    @ApiConflictResponse( { description: 'Already a member' } )
    async create(
        @CurrentUser() user: AccessTokenPayload,
        @CurrentOrganization() context: OrganizationContext,
        @Body( { schema: CreateInvitationBody } ) dto: CreateInvitationRequest,
    ): Promise<Invitation> {
        const organization = await this.organizationsService.findById( context.organizationId );

        if ( !organization ) {
            throw new NotFoundException( 'Organization not found' );
        }
        assertShared( organization );

        return this.invitationsService.create( context.organizationId, user.sub, dto );
    }

    @Delete( ':invitationId' )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiOperation( { summary: 'Revoke an invitation' } )
    @ApiNoContentResponse( { description: 'Revoked' } )
    revoke(
        @CurrentOrganization() context: OrganizationContext,
        @Param( 'invitationId', ParseUUIDPipe ) id: string,
    ): Promise<void> {
        return this.invitationsService.revoke( context.organizationId, id );
    }
}

/** Invitations addressed to the logged-in user. */
@ApiTags( 'organizations' )
@Controller( 'me/invitations' )
@Authenticated()
export class MyInvitationsController {
    constructor(
        private readonly invitationsService: InvitationsService,
        private readonly usersService: UsersService,
    ) {}

    @Get()
    @ApiOperation( { summary: 'Invitations to join organizations, sent to your email' } )
    @TypeboxResponse( Responses.MyInvitationList )
    async list( @CurrentUser() current: AccessTokenPayload ): Promise<MyInvitation[]> {
        return this.invitationsService.listForUser( await this.usersService.findByIdOrFail( current.sub ) );
    }

    @Post( ':invitationId/accept' )
    @HttpCode( HttpStatus.OK )
    @ApiOperation( { summary: 'Join the organization' } )
    @TypeboxResponse( Responses.MyOrganization )
    @ApiNotFoundResponse( { description: 'Invitation not found' } )
    @ApiBadRequestResponse( { description: 'The invitation has expired' } )
    async accept(
        @CurrentUser() current: AccessTokenPayload,
        @Param( 'invitationId', ParseUUIDPipe ) id: string,
    ): Promise<MyOrganization> {
        return this.invitationsService.accept( await this.usersService.findByIdOrFail( current.sub ), id );
    }

    @Post( ':invitationId/decline' )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiOperation( { summary: 'Decline an invitation' } )
    @ApiNoContentResponse( { description: 'Declined' } )
    @ApiNotFoundResponse( { description: 'Invitation not found' } )
    async decline(
        @CurrentUser() current: AccessTokenPayload,
        @Param( 'invitationId', ParseUUIDPipe ) id: string,
    ): Promise<void> {
        await this.invitationsService.decline( await this.usersService.findByIdOrFail( current.sub ), id );
    }
}
