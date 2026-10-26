import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CheckAbilities } from '@studylog/casl';
import { ListOrganizationsQueryParams, Responses } from '@studylog/nestjs';
import type { AdminOrganizationPage, ListOrganizationsQuery } from '@studylog/schemas';

import { PlatformAuth } from '../../auth/decorators/platform-auth.decorator.js';
import { AdminOrganizationsService } from '../services/admin-organizations.service.js';

@ApiTags( 'organizations (admin)' )
@Controller( 'admin/organizations' )
@PlatformAuth()
@CheckAbilities( [ 'manage', 'Organization' ] )
export class AdminOrganizationsController {
    constructor( private readonly adminOrganizations: AdminOrganizationsService ) {}

    @Get()
    @ApiOperation( {
        summary: 'Every organization, newest first, with its owners and size',
        description: 'Search matches the name or any member\'s email. Open one with GET /organizations/{id} (superadmins '
            + 'can read any organization, its members and its paths).',
    } )
    @TypeboxResponse( Responses.AdminOrganizationPage )
    @ApiBadRequestResponse( { description: 'Invalid filters' } )
    list(
        @Query( { schema: ListOrganizationsQueryParams } ) query: ListOrganizationsQuery,
    ): Promise<AdminOrganizationPage> {
        return this.adminOrganizations.list( query );
    }
}
