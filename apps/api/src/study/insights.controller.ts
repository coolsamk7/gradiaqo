import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Put, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccessTokenPayload } from '@studylog/casl';
import { AnalyticsQueryParams, ReadinessQueryParams, Responses, SetInterviewGoalBody } from '@studylog/nestjs';
import type {
    Analytics,
    AnalyticsQuery,
    InterviewGoal,
    Readiness,
    ReadinessQuery,
    SetInterviewGoalRequest,
} from '@studylog/schemas';

import { Authenticated } from '../auth/decorators/authenticated.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { InsightsService } from './insights.service.js';

@ApiTags( 'me: insights' )
@Controller( 'me' )
@Authenticated()
export class InsightsController {
    constructor( private readonly insights: InsightsService ) {}

    @Get( 'analytics' )
    @ApiOperation( { summary: 'Study time per week and path, item status, difficulty, habits and topics that need focus' } )
    @TypeboxResponse( Responses.Analytics )
    @ApiBadRequestResponse( { description: 'Unknown time zone or invalid filters' } )
    @ApiNotFoundResponse( { description: 'enrollmentId is not one of your paths' } )
    analytics(
        @CurrentUser() user: AccessTokenPayload,
        @Query( { schema: AnalyticsQueryParams } ) query: AnalyticsQuery,
    ): Promise<Analytics> {
        return this.insights.analytics( user.sub, query );
    }

    @Get( 'interview-goal' )
    @ApiOperation( { summary: 'Your interview goal' } )
    @TypeboxResponse( Responses.InterviewGoal )
    @ApiNotFoundResponse( { description: 'No goal yet' } )
    goal( @CurrentUser() user: AccessTokenPayload ): Promise<InterviewGoal> {
        return this.insights.goal( user.sub );
    }

    @Put( 'interview-goal' )
    @ApiOperation( { summary: 'Set or replace your interview goal' } )
    @TypeboxResponse( Responses.InterviewGoal )
    @ApiBadRequestResponse( { description: 'Invalid input, a date in the past, or paths you don\'t follow' } )
    setGoal(
        @CurrentUser() user: AccessTokenPayload,
        @Body( { schema: SetInterviewGoalBody } ) dto: SetInterviewGoalRequest,
    ): Promise<InterviewGoal> {
        return this.insights.setGoal( user.sub, dto );
    }

    @Delete( 'interview-goal' )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiOperation( { summary: 'Remove your interview goal' } )
    @ApiNoContentResponse( { description: 'Removed' } )
    @ApiNotFoundResponse( { description: 'No goal yet' } )
    removeGoal( @CurrentUser() user: AccessTokenPayload ): Promise<void> {
        return this.insights.removeGoal( user.sub );
    }

    @Get( 'readiness' )
    @ApiOperation( { summary: 'How ready you are for your interview goal: score, checks, pace and next steps' } )
    @TypeboxResponse( Responses.Readiness )
    @ApiBadRequestResponse( { description: 'Unknown time zone' } )
    readiness(
        @CurrentUser() user: AccessTokenPayload,
        @Query( { schema: ReadinessQueryParams } ) query: ReadinessQuery,
    ): Promise<Readiness> {
        return this.insights.readiness( user.sub, query.timeZone );
    }
}
