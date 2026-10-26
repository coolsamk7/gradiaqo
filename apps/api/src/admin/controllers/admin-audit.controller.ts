import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CheckAbilities } from '@studylog/casl';
import { ListAuditQueryParams, Responses } from '@studylog/nestjs';
import type { AuditPage, ListAuditQuery } from '@studylog/schemas';

import { AuditService } from '../../audit/services/audit.service.js';
import { PlatformAuth } from '../../auth/decorators/platform-auth.decorator.js';

@ApiTags( 'audit log (admin)' )
@Controller( 'admin/audit' )
@PlatformAuth()
@CheckAbilities( [ 'manage', 'all' ] )
export class AdminAuditController {
    constructor( private readonly audit: AuditService ) {}

    @Get()
    @ApiOperation( {
        summary: 'What superadmins did, newest first',
        description: 'Promoting, demoting and removing users; publishing, archiving and deleting global paths and '
            + 'items; dismissing reports and hiding or un-hiding paths.',
    } )
    @TypeboxResponse( Responses.AuditPage )
    @ApiBadRequestResponse( { description: 'Invalid filters' } )
    list( @Query( { schema: ListAuditQueryParams } ) query: ListAuditQuery ): Promise<AuditPage> {
        return this.audit.list( query );
    }
}
