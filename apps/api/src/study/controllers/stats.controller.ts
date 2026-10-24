import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccessTokenPayload } from '@studylog/casl';
import { Responses, StatsQueryParams } from '@studylog/nestjs';
import type { StatsQuery, StudyStats } from '@studylog/schemas';

import { Authenticated } from '../../auth/decorators/authenticated.decorator.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { StatsService } from '../services/stats.service.js';

@ApiTags( 'me: stats' )
@Controller( 'me/stats' )
@Authenticated()
export class StatsController {
    constructor( private readonly statsService: StatsService ) {}

    @Get()
    @ApiOperation( { summary: 'Study time today, this week and in total, streaks, and the last 30 days' } )
    @TypeboxResponse( Responses.StudyStats )
    @ApiBadRequestResponse( { description: 'Unknown time zone' } )
    get(
        @CurrentUser() user: AccessTokenPayload,
        @Query( { schema: StatsQueryParams } ) query: StatsQuery,
    ): Promise<StudyStats> {
        return this.statsService.get( user.sub, query.timeZone );
    }
}
