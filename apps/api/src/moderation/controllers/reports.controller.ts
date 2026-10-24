import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiConflictResponse,
    ApiNoContentResponse,
    ApiNotFoundResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '@studylog/casl';
import { CheckAbilities } from '@studylog/casl';
import { CreateReportBody, ListReportsQueryParams, ResolveReportBody, Responses } from '@studylog/nestjs';
import type {
    CreateReportRequest,
    ListReportsQuery,
    Report,
    ReportPage,
    ResolveReportRequest,
} from '@studylog/schemas';

import { Authenticated } from '../../auth/decorators/authenticated.decorator.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { PlatformAuth } from '../../auth/decorators/platform-auth.decorator.js';
import { RateLimit } from '../../rate-limits.js';
import { ReportsService } from '../services/reports.service.js';

@ApiTags( 'catalog' )
@Controller( 'catalog/paths/:pathId/reports' )
@Authenticated()
export class PathReportsController {
    constructor( private readonly reportsService: ReportsService ) {}

    @Post()
    @RateLimit( 'report' )
    @ApiOperation( { summary: 'Report a public path shared by another user (spam, inappropriate, copyright, other)' } )
    @TypeboxResponse( Responses.Report, { status: 201 } )
    @ApiBadRequestResponse( { description: 'Invalid input, not a user-shared public path, or your own path' } )
    @ApiNotFoundResponse( { description: 'Learning path not found' } )
    @ApiConflictResponse( { description: 'You already have an open report on this path' } )
    create(
        @CurrentUser() user: AccessTokenPayload,
        @Param( 'pathId', ParseUUIDPipe ) pathId: string,
        @Body( { schema: CreateReportBody } ) dto: CreateReportRequest,
    ): Promise<Report> {
        return this.reportsService.create( user.sub, pathId, dto );
    }
}

@ApiTags( 'moderation (admin)' )
@Controller( 'admin/reports' )
@PlatformAuth()
@CheckAbilities( [ 'manage', 'PathReport' ] )
export class AdminReportsController {
    constructor( private readonly reportsService: ReportsService ) {}

    @Get()
    @ApiOperation( { summary: 'Reports to review, oldest first (default: open ones)' } )
    @TypeboxResponse( Responses.ReportPage )
    @ApiBadRequestResponse( { description: 'Invalid filters' } )
    list( @Query( { schema: ListReportsQueryParams } ) query: ListReportsQuery ): Promise<ReportPage> {
        return this.reportsService.list( query );
    }

    @Patch( ':reportId' )
    @ApiOperation( {
        summary: 'Resolve a report: dismiss it, or hide the path from the public catalog for good',
        description: 'Hiding makes the path private (its owner keeps it) and closes all open reports on it.',
    } )
    @TypeboxResponse( Responses.Report )
    @ApiNotFoundResponse( { description: 'Report not found' } )
    @ApiConflictResponse( { description: 'Already resolved' } )
    resolve(
        @CurrentUser() user: AccessTokenPayload,
        @Param( 'reportId', ParseUUIDPipe ) id: string,
        @Body( { schema: ResolveReportBody } ) dto: ResolveReportRequest,
    ): Promise<Report> {
        return this.reportsService.resolve( user.sub, id, dto );
    }
}

@ApiTags( 'moderation (admin)' )
@Controller( 'admin/paths' )
@PlatformAuth()
@CheckAbilities( [ 'manage', 'PathReport' ] )
export class AdminHiddenPathsController {
    constructor( private readonly reportsService: ReportsService ) {}

    @Post( ':pathId/unhide' )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiOperation( {
        summary: 'Un-hide a path hidden by mistake',
        description: 'Clears publicBlockedAt. The path stays private until its owner makes it public again.',
    } )
    @ApiNoContentResponse( { description: 'Its owner can make it public again' } )
    @ApiNotFoundResponse( { description: 'Learning path not found' } )
    @ApiConflictResponse( { description: 'The path isn\'t hidden' } )
    unhide( @Param( 'pathId', ParseUUIDPipe ) pathId: string ): Promise<void> {
        return this.reportsService.unhide( pathId );
    }
}
