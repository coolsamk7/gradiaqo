import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import { Body, Controller, ForbiddenException, Get, NotFoundException, Patch, UseGuards } from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiOperation,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AccessTokenPayload, AppAbility, OrganizationContext } from '@studylog/casl';
import { CheckAbilities, CurrentAbility, CurrentOrganization } from '@studylog/casl';
import { Responses, UpdateOrganizationBody } from '@studylog/nestjs';
import type { Member, MyOrganization, UpdateOrganizationRequest } from '@studylog/schemas';

import { AuthGuard, CurrentUser } from '../auth/auth.guard.js';
import { OrganizationAuth } from './organization-auth.decorator.js';
import { OrganizationsService, toOrganizationResponse } from './organizations.service.js';

@ApiTags( 'organizations' )
@Controller( 'organizations' )
export class OrganizationsController {
    constructor( private readonly organizationsService: OrganizationsService ) {}

    @Get()
    @UseGuards( AuthGuard )
    @ApiBearerAuth()
    @ApiOperation( { summary: 'List the organizations you belong to, with your role in each' } )
    @TypeboxResponse( Responses.MyOrganizationList )
    @ApiUnauthorizedResponse( { description: 'Missing or invalid access token' } )
    listMine( @CurrentUser() user: AccessTokenPayload ): Promise<MyOrganization[]> {
        return this.organizationsService.listForUser( user.sub );
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
}
