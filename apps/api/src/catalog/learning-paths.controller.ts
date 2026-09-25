import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
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
import {
    CreateLearningModuleBody,
    CreateLearningPathBody,
    ReorderBody,
    Responses,
    UpdateLearningPathBody,
} from '@studylog/nestjs';
import type {
    CreateLearningModuleRequest,
    CreateLearningPathRequest,
    LearningModule,
    LearningPath,
    LearningPathTree,
    ReorderRequest,
    UpdateLearningPathRequest,
} from '@studylog/schemas';

import { CurrentUser } from '../auth/auth.guard.js';
import type { CatalogOwner as CatalogOwnerId } from './catalog.helpers.js';
import { CatalogAuth, CatalogOwner } from './catalog-auth.decorator.js';
import { LearningPathsService } from './learning-paths.service.js';
import { ModulesService } from './modules.service.js';

@ApiTags( 'catalog: manage' )
@Controller( [ 'admin/catalog/paths', 'organizations/:organizationId/catalog/paths' ] )
@CatalogAuth()
@CheckAbilities( [ 'manage', 'LearningPath' ] )
export class LearningPathsController {
    constructor(
        private readonly learningPathsService: LearningPathsService,
        private readonly modulesService: ModulesService,
    ) {}

    @Get()
    @ApiOperation( { summary: 'List learning paths in order, including drafts and archived ones' } )
    @TypeboxResponse( Responses.LearningPathList )
    list(
        @CatalogOwner() owner: CatalogOwnerId,
    ): Promise<LearningPath[]> {
        return this.learningPathsService.list( owner );
    }

    @Post()
    @ApiOperation( { summary: 'Create a learning path (added at the end)' } )
    @TypeboxResponse( Responses.LearningPath, { status: 201 } )
    @ApiBadRequestResponse( { description: 'Invalid input' } )
    @ApiConflictResponse( { description: 'Slug already used by another path' } )
    create(
        @CatalogOwner() owner: CatalogOwnerId,
        @CurrentUser() user: AccessTokenPayload,
        @Body( { schema: CreateLearningPathBody } ) dto: CreateLearningPathRequest,
    ): Promise<LearningPath> {
        return this.learningPathsService.create( owner, dto, user.sub );
    }

    @Put( 'order' )
    @ApiOperation( { summary: 'Reorder learning paths: send every path id in the new order' } )
    @TypeboxResponse( Responses.LearningPathList )
    @ApiBadRequestResponse( { description: 'ids is not exactly the current paths' } )
    reorder(
        @CatalogOwner() owner: CatalogOwnerId,
        @Body( { schema: ReorderBody } ) dto: ReorderRequest,
    ): Promise<LearningPath[]> {
        return this.learningPathsService.reorder( owner, dto.ids );
    }

    @Get( ':pathId' )
    @ApiOperation( { summary: 'Get a learning path with all its modules, topics and items, in order' } )
    @TypeboxResponse( Responses.LearningPathTree )
    @ApiNotFoundResponse( { description: 'Learning path not found' } )
    findTree(
        @CatalogOwner() owner: CatalogOwnerId,
        @Param( 'pathId', ParseUUIDPipe ) pathId: string,
    ): Promise<LearningPathTree> {
        return this.learningPathsService.findTree( owner, pathId );
    }

    @Patch( ':pathId' )
    @ApiOperation( { summary: 'Update a learning path (the slug only changes when sent)' } )
    @TypeboxResponse( Responses.LearningPath )
    @ApiBadRequestResponse( { description: 'Invalid input' } )
    @ApiNotFoundResponse( { description: 'Learning path not found' } )
    @ApiConflictResponse( { description: 'Slug already used by another path' } )
    update(
        @CatalogOwner() owner: CatalogOwnerId,
        @Param( 'pathId', ParseUUIDPipe ) pathId: string,
        @Body( { schema: UpdateLearningPathBody } ) dto: UpdateLearningPathRequest,
    ): Promise<LearningPath> {
        return this.learningPathsService.update( owner, pathId, dto );
    }

    @Delete( ':pathId' )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiOperation( { summary: 'Delete a learning path and its modules, topics and enrollments (items are kept)' } )
    @ApiNoContentResponse( { description: 'Deleted' } )
    @ApiNotFoundResponse( { description: 'Learning path not found' } )
    @ApiConflictResponse( { description: 'Global catalog only: not a draft, archive it instead' } )
    remove(
        @CatalogOwner() owner: CatalogOwnerId,
        @Param( 'pathId', ParseUUIDPipe ) pathId: string,
    ): Promise<void> {
        return this.learningPathsService.remove( owner, pathId );
    }

    @Post( ':pathId/modules' )
    @CheckAbilities( [ 'manage', 'LearningModule' ] )
    @ApiOperation( { summary: 'Add a module to the end of a learning path' } )
    @TypeboxResponse( Responses.LearningModule, { status: 201 } )
    @ApiBadRequestResponse( { description: 'Invalid input' } )
    @ApiNotFoundResponse( { description: 'Learning path not found' } )
    @ApiConflictResponse( { description: 'Slug already used by another module in this path' } )
    createModule(
        @CatalogOwner() owner: CatalogOwnerId,
        @Param( 'pathId', ParseUUIDPipe ) pathId: string,
        @Body( { schema: CreateLearningModuleBody } ) dto: CreateLearningModuleRequest,
    ): Promise<LearningModule> {
        return this.modulesService.create( owner, pathId, dto );
    }

    @Put( ':pathId/modules/order' )
    @CheckAbilities( [ 'manage', 'LearningModule' ] )
    @ApiOperation( { summary: 'Reorder the modules of a learning path: send every module id in the new order' } )
    @TypeboxResponse( Responses.LearningModuleList )
    @ApiBadRequestResponse( { description: 'ids is not exactly the current modules' } )
    @ApiNotFoundResponse( { description: 'Learning path not found' } )
    reorderModules(
        @CatalogOwner() owner: CatalogOwnerId,
        @Param( 'pathId', ParseUUIDPipe ) pathId: string,
        @Body( { schema: ReorderBody } ) dto: ReorderRequest,
    ): Promise<LearningModule[]> {
        return this.modulesService.reorder( owner, pathId, dto.ids );
    }
}
