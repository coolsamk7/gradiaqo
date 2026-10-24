import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiConflictResponse,
    ApiNoContentResponse,
    ApiNotFoundResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { CheckAbilities } from '@studylog/casl';
import { CreateTopicBody, ReorderBody, Responses, UpdateLearningModuleBody } from '@studylog/nestjs';
import type {
    CreateTopicRequest,
    LearningModule,
    ReorderRequest,
    Topic,
    UpdateLearningModuleRequest,
} from '@studylog/schemas';

import type { CatalogOwner as CatalogOwnerId } from '../catalog.helpers.js';
import { CatalogAuth, CatalogOwner } from '../decorators/catalog-auth.decorator.js';
import { ModulesService } from '../services/modules.service.js';
import { TopicsService } from '../services/topics.service.js';

@ApiTags( 'catalog: manage' )
@Controller( [ 'admin/catalog/modules', 'organizations/:organizationId/catalog/modules' ] )
@CatalogAuth()
@CheckAbilities( [ 'manage', 'LearningModule' ] )
export class ModulesController {
    constructor(
        private readonly modulesService: ModulesService,
        private readonly topicsService: TopicsService,
    ) {}

    @Patch( ':moduleId' )
    @ApiOperation( { summary: 'Update a module (the slug only changes when sent)' } )
    @TypeboxResponse( Responses.LearningModule )
    @ApiBadRequestResponse( { description: 'Invalid input' } )
    @ApiNotFoundResponse( { description: 'Module not found' } )
    @ApiConflictResponse( { description: 'Slug already used by another module in this path' } )
    update(
        @CatalogOwner() owner: CatalogOwnerId,
        @Param( 'moduleId', ParseUUIDPipe ) moduleId: string,
        @Body( { schema: UpdateLearningModuleBody } ) dto: UpdateLearningModuleRequest,
    ): Promise<LearningModule> {
        return this.modulesService.update( owner, moduleId, dto );
    }

    @Delete( ':moduleId' )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiOperation( { summary: 'Delete a module and its topics (items are kept)' } )
    @ApiNoContentResponse( { description: 'Deleted' } )
    @ApiNotFoundResponse( { description: 'Module not found' } )
    @ApiConflictResponse( { description: 'Global catalog only: not a draft, archive it instead' } )
    remove(
        @CatalogOwner() owner: CatalogOwnerId,
        @Param( 'moduleId', ParseUUIDPipe ) moduleId: string,
    ): Promise<void> {
        return this.modulesService.remove( owner, moduleId );
    }

    @Post( ':moduleId/topics' )
    @CheckAbilities( [ 'manage', 'Topic' ] )
    @ApiOperation( { summary: 'Add a topic to the end of a module' } )
    @TypeboxResponse( Responses.Topic, { status: 201 } )
    @ApiBadRequestResponse( { description: 'Invalid input' } )
    @ApiNotFoundResponse( { description: 'Module not found' } )
    @ApiConflictResponse( { description: 'Slug already used by another topic in this module' } )
    createTopic(
        @CatalogOwner() owner: CatalogOwnerId,
        @Param( 'moduleId', ParseUUIDPipe ) moduleId: string,
        @Body( { schema: CreateTopicBody } ) dto: CreateTopicRequest,
    ): Promise<Topic> {
        return this.topicsService.create( owner, moduleId, dto );
    }

    @Put( ':moduleId/topics/order' )
    @CheckAbilities( [ 'manage', 'Topic' ] )
    @ApiOperation( { summary: 'Reorder the topics of a module: send every topic id in the new order' } )
    @TypeboxResponse( Responses.TopicList )
    @ApiBadRequestResponse( { description: 'ids is not exactly the current topics' } )
    @ApiNotFoundResponse( { description: 'Module not found' } )
    reorderTopics(
        @CatalogOwner() owner: CatalogOwnerId,
        @Param( 'moduleId', ParseUUIDPipe ) moduleId: string,
        @Body( { schema: ReorderBody } ) dto: ReorderRequest,
    ): Promise<Topic[]> {
        return this.topicsService.reorder( owner, moduleId, dto.ids );
    }
}
