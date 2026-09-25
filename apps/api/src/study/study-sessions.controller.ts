import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiNoContentResponse,
    ApiNotFoundResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '@studylog/casl';
import {
    CreateStudySessionBody,
    ListStudySessionsQueryParams,
    Responses,
    UpdateStudySessionBody,
} from '@studylog/nestjs';
import type {
    CreateStudySessionRequest,
    ListStudySessionsQuery,
    StudySession,
    StudySessionPage,
    UpdateStudySessionRequest,
} from '@studylog/schemas';

import { CurrentUser } from '../auth/auth.guard.js';
import { Authenticated } from '../auth/authenticated.decorator.js';
import { StudySessionsService } from './study-sessions.service.js';

@ApiTags( 'me: study sessions' )
@Controller( 'me/study-sessions' )
@Authenticated()
export class StudySessionsController {
    constructor( private readonly studySessionsService: StudySessionsService ) {}

    @Get()
    @ApiOperation( { summary: 'Your study sessions, newest first' } )
    @TypeboxResponse( Responses.StudySessionPage )
    @ApiBadRequestResponse( { description: 'Invalid filters' } )
    list(
        @CurrentUser() user: AccessTokenPayload,
        @Query( { schema: ListStudySessionsQueryParams } ) query: ListStudySessionsQuery,
    ): Promise<StudySessionPage> {
        return this.studySessionsService.list( user.sub, query );
    }

    @Post()
    @ApiOperation( { summary: 'Log time spent on a topic and/or item' } )
    @TypeboxResponse( Responses.StudySession, { status: 201 } )
    @ApiBadRequestResponse( { description: 'Invalid input, no topic or item, the item isn\'t in the topic, or a future start' } )
    @ApiNotFoundResponse( { description: 'Topic or item not found or not published' } )
    create(
        @CurrentUser() user: AccessTokenPayload,
        @Body( { schema: CreateStudySessionBody } ) dto: CreateStudySessionRequest,
    ): Promise<StudySession> {
        return this.studySessionsService.create( user.sub, dto );
    }

    @Patch( ':sessionId' )
    @ApiOperation( { summary: 'Edit a study session' } )
    @TypeboxResponse( Responses.StudySession )
    @ApiBadRequestResponse( { description: 'Invalid input' } )
    @ApiNotFoundResponse( { description: 'Study session, topic or item not found' } )
    update(
        @CurrentUser() user: AccessTokenPayload,
        @Param( 'sessionId', ParseUUIDPipe ) id: string,
        @Body( { schema: UpdateStudySessionBody } ) dto: UpdateStudySessionRequest,
    ): Promise<StudySession> {
        return this.studySessionsService.update( user.sub, id, dto );
    }

    @Delete( ':sessionId' )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiOperation( { summary: 'Delete a study session' } )
    @ApiNoContentResponse( { description: 'Deleted' } )
    @ApiNotFoundResponse( { description: 'Study session not found' } )
    remove(
        @CurrentUser() user: AccessTokenPayload,
        @Param( 'sessionId', ParseUUIDPipe ) id: string,
    ): Promise<void> {
        return this.studySessionsService.remove( user.sub, id );
    }
}
