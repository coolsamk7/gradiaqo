import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseEnumPipe,
    ParseUUIDPipe,
    Patch,
    Post,
    Put,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiConflictResponse,
    ApiNoContentResponse,
    ApiNotFoundResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '@studylog/casl';
import { OrderParentType } from '@studylog/database';
import {
    CreateEnrollmentBody,
    ReorderBody,
    ReplaceRulesBody,
    Responses,
    UpdateEnrollmentBody,
} from '@studylog/nestjs';
import type {
    CreateEnrollmentRequest,
    Enrollment,
    EnrollmentDetail,
    ReorderRequest,
    ReplaceRulesRequest,
    UpdateEnrollmentRequest,
} from '@studylog/schemas';

import { CurrentUser } from '../auth/auth.guard.js';
import { Authenticated } from '../auth/authenticated.decorator.js';
import { EnrollmentsService } from './enrollments.service.js';

const ParentType = new ParseEnumPipe( OrderParentType );

@ApiTags( 'me: enrollments' )
@Controller( 'me/enrollments' )
@Authenticated()
export class EnrollmentsController {
    constructor( private readonly enrollmentsService: EnrollmentsService ) {}

    @Get()
    @ApiOperation( { summary: 'Your learning paths, in dashboard order, with progress' } )
    @TypeboxResponse( Responses.EnrollmentList )
    list( @CurrentUser() user: AccessTokenPayload ): Promise<Enrollment[]> {
        return this.enrollmentsService.list( user.sub );
    }

    @Post()
    @ApiOperation( {
        summary: 'Enroll in a published learning path',
        description: 'Without include rules you get the whole path, including content added later.',
    } )
    @TypeboxResponse( Responses.EnrollmentDetail, { status: 201 } )
    @ApiBadRequestResponse( { description: 'Invalid input, or a rule points outside the path' } )
    @ApiNotFoundResponse( { description: 'Learning path not found or not published' } )
    @ApiConflictResponse( { description: 'Already enrolled in this path' } )
    create(
        @CurrentUser() user: AccessTokenPayload,
        @Body( { schema: CreateEnrollmentBody } ) dto: CreateEnrollmentRequest,
    ): Promise<EnrollmentDetail> {
        return this.enrollmentsService.create( user.sub, dto );
    }

    @Put( 'order' )
    @ApiOperation( { summary: 'Reorder your dashboard: send every enrollment id in the new order' } )
    @TypeboxResponse( Responses.EnrollmentList )
    @ApiBadRequestResponse( { description: 'ids is not exactly your enrollments' } )
    reorder(
        @CurrentUser() user: AccessTokenPayload,
        @Body( { schema: ReorderBody } ) dto: ReorderRequest,
    ): Promise<Enrollment[]> {
        return this.enrollmentsService.reorder( user.sub, dto.ids );
    }

    @Get( ':enrollmentId' )
    @ApiOperation( { summary: 'Your view of a path: the parts you chose, in your order, with progress' } )
    @TypeboxResponse( Responses.EnrollmentDetail )
    @ApiNotFoundResponse( { description: 'Enrollment not found' } )
    detail(
        @CurrentUser() user: AccessTokenPayload,
        @Param( 'enrollmentId', ParseUUIDPipe ) id: string,
    ): Promise<EnrollmentDetail> {
        return this.enrollmentsService.detail( user.sub, id );
    }

    @Patch( ':enrollmentId' )
    @ApiOperation( { summary: 'Change the status (active, paused, completed, dropped)' } )
    @TypeboxResponse( Responses.EnrollmentDetail )
    @ApiBadRequestResponse( { description: 'Invalid input' } )
    @ApiNotFoundResponse( { description: 'Enrollment not found' } )
    update(
        @CurrentUser() user: AccessTokenPayload,
        @Param( 'enrollmentId', ParseUUIDPipe ) id: string,
        @Body( { schema: UpdateEnrollmentBody } ) dto: UpdateEnrollmentRequest,
    ): Promise<EnrollmentDetail> {
        return this.enrollmentsService.updateStatus( user.sub, id, dto.status );
    }

    @Delete( ':enrollmentId' )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiOperation( { summary: 'Unenroll. Your progress and study sessions are kept.' } )
    @ApiNoContentResponse( { description: 'Unenrolled' } )
    @ApiNotFoundResponse( { description: 'Enrollment not found' } )
    remove(
        @CurrentUser() user: AccessTokenPayload,
        @Param( 'enrollmentId', ParseUUIDPipe ) id: string,
    ): Promise<void> {
        return this.enrollmentsService.remove( user.sub, id );
    }

    @Put( ':enrollmentId/rules' )
    @ApiOperation( {
        summary: 'Replace which parts of the path you follow',
        description: 'Include or exclude modules, topics and items; the most specific rule wins. '
            + 'An empty list means the whole path. "Skip this item" is an exclude rule on the item.',
    } )
    @TypeboxResponse( Responses.EnrollmentDetail )
    @ApiBadRequestResponse( { description: 'A rule points outside the path, or is repeated' } )
    @ApiNotFoundResponse( { description: 'Enrollment not found' } )
    replaceRules(
        @CurrentUser() user: AccessTokenPayload,
        @Param( 'enrollmentId', ParseUUIDPipe ) id: string,
        @Body( { schema: ReplaceRulesBody } ) dto: ReplaceRulesRequest,
    ): Promise<EnrollmentDetail> {
        return this.enrollmentsService.replaceRules( user.sub, id, dto.rules );
    }

    @Put( ':enrollmentId/orders/:parentType/:parentId' )
    @ApiOperation( {
        summary: 'Set your own order for a path\'s modules, a module\'s topics or a topic\'s items',
        description: 'List some or all children; the rest follow in the admin\'s order.',
    } )
    @TypeboxResponse( Responses.EnrollmentDetail )
    @ApiBadRequestResponse( { description: 'ids are not children of that parent' } )
    @ApiNotFoundResponse( { description: 'Enrollment or parent not found' } )
    setOrder(
        @CurrentUser() user: AccessTokenPayload,
        @Param( 'enrollmentId', ParseUUIDPipe ) id: string,
        @Param( 'parentType', ParentType ) parentType: OrderParentType,
        @Param( 'parentId', ParseUUIDPipe ) parentId: string,
        @Body( { schema: ReorderBody } ) dto: ReorderRequest,
    ): Promise<EnrollmentDetail> {
        return this.enrollmentsService.setOrder( user.sub, id, parentType, parentId, dto.ids );
    }

    @Delete( ':enrollmentId/orders/:parentType/:parentId' )
    @ApiOperation( { summary: 'Go back to the admin\'s order for one parent' } )
    @TypeboxResponse( Responses.EnrollmentDetail )
    @ApiNotFoundResponse( { description: 'Enrollment not found' } )
    clearOrder(
        @CurrentUser() user: AccessTokenPayload,
        @Param( 'enrollmentId', ParseUUIDPipe ) id: string,
        @Param( 'parentType', ParentType ) parentType: OrderParentType,
        @Param( 'parentId', ParseUUIDPipe ) parentId: string,
    ): Promise<EnrollmentDetail> {
        return this.enrollmentsService.clearOrder( user.sub, id, parentType, parentId );
    }
}
