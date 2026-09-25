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
import { CheckAbilities } from '@studylog/casl';
import { LinkItemBody, ReorderBody, Responses, UpdateTopicBody } from '@studylog/nestjs';
import type { LinkItemRequest, ReorderRequest, Topic, TopicItem, UpdateTopicRequest } from '@studylog/schemas';

import type { CatalogOwner as CatalogOwnerId } from './catalog.helpers.js';
import { CatalogAuth, CatalogOwner } from './catalog-auth.decorator.js';
import { TopicsService } from './topics.service.js';

@ApiTags( 'catalog: manage' )
@Controller( [ 'admin/catalog/topics', 'organizations/:organizationId/catalog/topics' ] )
@CatalogAuth()
@CheckAbilities( [ 'manage', 'Topic' ] )
export class TopicsController {
    constructor( private readonly topicsService: TopicsService ) {}

    @Patch( ':topicId' )
    @ApiOperation( { summary: 'Update a topic (the slug only changes when sent)' } )
    @TypeboxResponse( Responses.Topic )
    @ApiBadRequestResponse( { description: 'Invalid input' } )
    @ApiNotFoundResponse( { description: 'Topic not found' } )
    @ApiConflictResponse( { description: 'Slug already used by another topic in this module' } )
    update(
        @CatalogOwner() owner: CatalogOwnerId,
        @Param( 'topicId', ParseUUIDPipe ) topicId: string,
        @Body( { schema: UpdateTopicBody } ) dto: UpdateTopicRequest,
    ): Promise<Topic> {
        return this.topicsService.update( owner, topicId, dto );
    }

    @Delete( ':topicId' )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiOperation( { summary: 'Delete a topic (its items are kept)' } )
    @ApiNoContentResponse( { description: 'Deleted' } )
    @ApiNotFoundResponse( { description: 'Topic not found' } )
    @ApiConflictResponse( { description: 'Global catalog only: not a draft, archive it instead' } )
    remove(
        @CatalogOwner() owner: CatalogOwnerId,
        @Param( 'topicId', ParseUUIDPipe ) topicId: string,
    ): Promise<void> {
        return this.topicsService.remove( owner, topicId );
    }

    @Get( ':topicId/items' )
    @ApiOperation( { summary: 'List the items of a topic, in order' } )
    @TypeboxResponse( Responses.TopicItemList )
    @ApiNotFoundResponse( { description: 'Topic not found' } )
    listItems(
        @CatalogOwner() owner: CatalogOwnerId,
        @Param( 'topicId', ParseUUIDPipe ) topicId: string,
    ): Promise<TopicItem[]> {
        return this.topicsService.listItems( owner, topicId );
    }

    // Declared before `:itemId` so "order" isn't taken for an item id.
    @Put( ':topicId/items/order' )
    @ApiOperation( { summary: 'Reorder the items of a topic: send every item id in the new order' } )
    @TypeboxResponse( Responses.TopicItemList )
    @ApiBadRequestResponse( { description: 'ids is not exactly the current items' } )
    @ApiNotFoundResponse( { description: 'Topic not found' } )
    reorderItems(
        @CatalogOwner() owner: CatalogOwnerId,
        @Param( 'topicId', ParseUUIDPipe ) topicId: string,
        @Body( { schema: ReorderBody } ) dto: ReorderRequest,
    ): Promise<TopicItem[]> {
        return this.topicsService.reorderItems( owner, topicId, dto.ids );
    }

    @Put( ':topicId/items/:itemId' )
    @ApiOperation( {
        summary: 'Add an item to the end of a topic',
        description: 'Safe to repeat: if the item is already there it keeps its position, and only isOptional is updated. '
            + 'An organization can also link published items of the global catalog.',
    } )
    @TypeboxResponse( Responses.TopicItem )
    @ApiBadRequestResponse( { description: 'Invalid input' } )
    @ApiNotFoundResponse( { description: 'Topic or item not found' } )
    linkItem(
        @CatalogOwner() owner: CatalogOwnerId,
        @Param( 'topicId', ParseUUIDPipe ) topicId: string,
        @Param( 'itemId', ParseUUIDPipe ) itemId: string,
        @Body( { schema: LinkItemBody } ) dto: LinkItemRequest,
    ): Promise<TopicItem> {
        return this.topicsService.linkItem( owner, topicId, itemId, dto );
    }

    @Delete( ':topicId/items/:itemId' )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiOperation( { summary: 'Remove an item from a topic (the item stays in the catalog)' } )
    @ApiNoContentResponse( { description: 'Removed' } )
    @ApiNotFoundResponse( { description: 'The item is not in this topic' } )
    unlinkItem(
        @CatalogOwner() owner: CatalogOwnerId,
        @Param( 'topicId', ParseUUIDPipe ) topicId: string,
        @Param( 'itemId', ParseUUIDPipe ) itemId: string,
    ): Promise<void> {
        return this.topicsService.unlinkItem( owner, topicId, itemId );
    }
}
