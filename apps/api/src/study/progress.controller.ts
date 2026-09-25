import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccessTokenPayload } from '@studylog/casl';
import { ListProgressQueryParams, Responses, UpdateProgressBody } from '@studylog/nestjs';
import type { ItemProgress, ItemProgressPage, ListProgressQuery, UpdateProgressRequest } from '@studylog/schemas';

import { CurrentUser } from '../auth/auth.guard.js';
import { Authenticated } from '../auth/authenticated.decorator.js';
import { ProgressService } from './progress.service.js';

@ApiTags( 'me: progress' )
@Controller( 'me/progress' )
@Authenticated()
export class ProgressController {
    constructor( private readonly progressService: ProgressService ) {}

    @Get()
    @ApiOperation( { summary: 'Items you have progress on, most recently updated first' } )
    @TypeboxResponse( Responses.ItemProgressPage )
    @ApiBadRequestResponse( { description: 'Invalid filters' } )
    list(
        @CurrentUser() user: AccessTokenPayload,
        @Query( { schema: ListProgressQueryParams } ) query: ListProgressQuery,
    ): Promise<ItemProgressPage> {
        return this.progressService.list( user.sub, query );
    }

    @Get( ':itemId' )
    @ApiOperation( { summary: 'Your progress on one item' } )
    @TypeboxResponse( Responses.ItemProgress )
    @ApiNotFoundResponse( { description: 'Item not found or not published' } )
    get(
        @CurrentUser() user: AccessTokenPayload,
        @Param( 'itemId', ParseUUIDPipe ) itemId: string,
    ): Promise<ItemProgress> {
        return this.progressService.get( user.sub, itemId );
    }

    @Put( ':itemId' )
    @ApiOperation( {
        summary: 'Set your status on an item',
        description: 'Counts in every path and topic the item appears in. `not_started` clears it.',
    } )
    @TypeboxResponse( Responses.ItemProgress )
    @ApiBadRequestResponse( { description: 'Invalid status' } )
    @ApiNotFoundResponse( { description: 'Item not found or not published' } )
    set(
        @CurrentUser() user: AccessTokenPayload,
        @Param( 'itemId', ParseUUIDPipe ) itemId: string,
        @Body( { schema: UpdateProgressBody } ) dto: UpdateProgressRequest,
    ): Promise<ItemProgress> {
        return this.progressService.set( user.sub, itemId, dto.status );
    }
}
