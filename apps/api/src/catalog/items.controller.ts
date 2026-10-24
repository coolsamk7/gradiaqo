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
    ApiConflictResponse,
    ApiNoContentResponse,
    ApiNotFoundResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import type { AccessTokenPayload } from '@studylog/casl';
import { CheckAbilities } from '@studylog/casl';
import { CreateItemBody, ListItemsQueryParams, Responses, UpdateItemBody } from '@studylog/nestjs';
import type { CreateItemRequest, Item, ListItemsQuery, ManagedItemPage, UpdateItemRequest } from '@studylog/schemas';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { CatalogOwner as CatalogOwnerId } from './catalog.helpers.js';
import { CatalogAuth, CatalogOwner } from './catalog-auth.decorator.js';
import { ItemsService } from './items.service.js';

@ApiTags( 'catalog: manage' )
@Controller( [ 'admin/catalog/items', 'organizations/:organizationId/catalog/items' ] )
@CatalogAuth()
@CheckAbilities( [ 'manage', 'Item' ] )
export class ItemsController {
    constructor( private readonly itemsService: ItemsService ) {}

    @Get()
    @ApiOperation( { summary: 'Search study material by type, status, tag or title, with how many topics use each' } )
    @TypeboxResponse( Responses.ManagedItemPage )
    @ApiBadRequestResponse( { description: 'Invalid filters' } )
    list(
        @CatalogOwner() owner: CatalogOwnerId,
        @Query( { schema: ListItemsQueryParams } ) query: ListItemsQuery,
    ): Promise<ManagedItemPage> {
        return this.itemsService.list( owner, query );
    }

    @Post()
    @ApiOperation( {
        summary: 'Create study material',
        description: 'The fields of `details` depend on `type`: see the ProblemDetails, VideoDetails, ... schemas.',
    } )
    @TypeboxResponse( Responses.Item, { status: 201 } )
    @ApiBadRequestResponse( { description: 'Invalid input, including details that don\'t fit the type' } )
    create(
        @CatalogOwner() owner: CatalogOwnerId,
        @CurrentUser() user: AccessTokenPayload,
        @Body( { schema: CreateItemBody } ) dto: CreateItemRequest,
    ): Promise<Item> {
        return this.itemsService.create( owner, dto, user.sub );
    }

    @Get( ':itemId' )
    @ApiOperation( { summary: 'Get one item' } )
    @TypeboxResponse( Responses.Item )
    @ApiNotFoundResponse( { description: 'Item not found' } )
    findOne(
        @CatalogOwner() owner: CatalogOwnerId,
        @Param( 'itemId', ParseUUIDPipe ) itemId: string,
    ): Promise<Item> {
        return this.itemsService.findOrFail( owner, itemId );
    }

    @Patch( ':itemId' )
    @ApiOperation( { summary: 'Update an item. The type can\'t change; `details` is replaced as a whole.' } )
    @TypeboxResponse( Responses.Item )
    @ApiBadRequestResponse( { description: 'Invalid input, including details that don\'t fit the type' } )
    @ApiNotFoundResponse( { description: 'Item not found' } )
    update(
        @CatalogOwner() owner: CatalogOwnerId,
        @Param( 'itemId', ParseUUIDPipe ) itemId: string,
        @Body( { schema: UpdateItemBody } ) dto: UpdateItemRequest,
    ): Promise<Item> {
        return this.itemsService.update( owner, itemId, dto );
    }

    @Delete( ':itemId' )
    @HttpCode( HttpStatus.NO_CONTENT )
    @ApiOperation( { summary: 'Delete an item, removing it from every topic' } )
    @ApiNoContentResponse( { description: 'Deleted' } )
    @ApiNotFoundResponse( { description: 'Item not found' } )
    @ApiConflictResponse( { description: 'Global catalog only: not a draft, archive it instead' } )
    remove(
        @CatalogOwner() owner: CatalogOwnerId,
        @Param( 'itemId', ParseUUIDPipe ) itemId: string,
    ): Promise<void> {
        return this.itemsService.remove( owner, itemId );
    }
}
