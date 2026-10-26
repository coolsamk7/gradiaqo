import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CheckAbilities } from '@studylog/casl';
import { Responses } from '@studylog/nestjs';
import type { PlatformOverview } from '@studylog/schemas';

import { PlatformAuth } from '../../auth/decorators/platform-auth.decorator.js';
import { AdminOverviewService } from '../services/admin-overview.service.js';

@ApiTags( 'overview (admin)' )
@Controller( 'admin/overview' )
@PlatformAuth()
@CheckAbilities( [ 'manage', 'all' ] )
export class AdminOverviewController {
    constructor( private readonly adminOverview: AdminOverviewService ) {}

    @Get()
    @ApiOperation( {
        summary: 'The platform at a glance',
        description: 'Accounts, active users, sign-ups per day, study and the most followed paths, over the last 30 days.',
    } )
    @TypeboxResponse( Responses.PlatformOverview )
    overview(): Promise<PlatformOverview> {
        return this.adminOverview.overview();
    }
}
