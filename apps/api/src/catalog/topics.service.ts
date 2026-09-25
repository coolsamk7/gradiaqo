import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { CatalogStatus, Item, Topic, TopicItem } from '@studylog/database';
import type {
    CreateTopicRequest,
    LinkItemRequest,
    TopicItem as TopicItemView,
    UpdateTopicRequest,
} from '@studylog/schemas';
import { DataSource, IsNull } from 'typeorm';

import type { CatalogOwner } from './catalog.helpers.js';
import {
    assertDeletable,
    assertSameChildren,
    defaultStatus,
    nextPosition,
    ownedBy,
    saveUnique,
    toSlug,
    writePositions,
} from './catalog.helpers.js';
import { toTopicItemView } from './catalog-tree.service.js';
import { ModulesService } from './modules.service.js';

const slugTaken = ( slug: string ) => `This module already has a topic with slug "${slug}"`;

@Injectable()
export class TopicsService {
    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly modulesService: ModulesService,
    ) {}

    /** A topic in one of this owner's paths; any other topic is "not found". */
    async findOrFail( owner: CatalogOwner, id: string ): Promise<Topic> {
        const topic = await this.dataSource.getRepository( Topic ).findOneBy( {
            id,
            module: { learningPath: { organizationId: ownedBy( owner ) } },
        } );

        if ( !topic ) {
            throw new NotFoundException( 'Topic not found' );
        }

        return topic;
    }

    async create( owner: CatalogOwner, moduleId: string, dto: CreateTopicRequest ): Promise<Topic> {
        await this.modulesService.findOrFail( owner, moduleId );

        const slug = dto.slug ?? toSlug( dto.title );

        return saveUnique(
            () => this.dataSource.transaction( async ( manager ) =>
                manager.save( manager.create( Topic, {
                    status: defaultStatus( owner ),
                    ...dto,
                    slug,
                    moduleId,
                    position: await nextPosition( manager, Topic, { moduleId } ),
                } ) ) ),
            slugTaken( slug ),
        );
    }

    async update( owner: CatalogOwner, id: string, dto: UpdateTopicRequest ): Promise<Topic> {
        const topic = await this.findOrFail( owner, id );

        return saveUnique(
            () => this.dataSource.getRepository( Topic ).save( Object.assign( topic, dto ) ),
            slugTaken( dto.slug ?? topic.slug ),
        );
    }

    /** Deletes a topic. Its items stay in the catalog, only their links go. */
    async remove( owner: CatalogOwner, id: string ): Promise<void> {
        const topic = await this.findOrFail( owner, id );

        assertDeletable( owner, topic, 'topic' );
        await this.dataSource.getRepository( Topic ).remove( topic );
    }

    async reorder( owner: CatalogOwner, moduleId: string, ids: string[] ): Promise<Topic[]> {
        await this.modulesService.findOrFail( owner, moduleId );

        return this.dataSource.transaction( async ( manager ) => {
            const current = await manager.find( Topic, { select: { id: true }, where: { moduleId } } );

            assertSameChildren( ids, current.map( ( topic ) => topic.id ) );
            await writePositions( manager, 'topics', ids, { column: 'module_id', value: moduleId } );

            return manager.find( Topic, { where: { moduleId }, order: { position: 'ASC' } } );
        } );
    }

    /** The topic's items, in order. */
    async listItems( owner: CatalogOwner, topicId: string ): Promise<TopicItemView[]> {
        await this.findOrFail( owner, topicId );

        return this.findLinks( topicId );
    }

    /**
     * Adds an item to the end of the topic. Linking an item that's already there only updates `isOptional`
     * (when given) and keeps its position, so the call can safely be repeated.
     *
     * The item must belong to the same catalog, or, for an organization, be a published global item: users can
     * reuse the global catalog's material without copying it.
     */
    async linkItem(
        owner: CatalogOwner,
        topicId: string,
        itemId: string,
        dto: LinkItemRequest,
    ): Promise<TopicItemView> {
        await this.findOrFail( owner, topicId );

        const items = this.dataSource.getRepository( Item );
        const usable = await items.existsBy( { id: itemId, organizationId: ownedBy( owner ) } )
            || ( owner !== null
                && await items.existsBy( { id: itemId, organizationId: IsNull(), status: CatalogStatus.Published } ) );

        if ( !usable ) {
            throw new NotFoundException( 'Item not found' );
        }

        await this.dataSource.transaction( async ( manager ) => {
            const existing = await manager.findOneBy( TopicItem, { topicId, itemId } );

            if ( existing ) {
                if ( dto.isOptional !== undefined ) {
                    await manager.update( TopicItem, { topicId, itemId }, { isOptional: dto.isOptional } );
                }

                return;
            }
            await manager.insert( TopicItem, {
                topicId,
                itemId,
                isOptional: dto.isOptional ?? false,
                position: await nextPosition( manager, TopicItem, { topicId } ),
            } );
        } );

        const link = await this.dataSource.getRepository( TopicItem ).findOneOrFail( {
            where: { topicId, itemId },
            relations: { item: true },
        } );

        return toTopicItemView( link );
    }

    /** Removes the item from this topic only; the item itself stays in the catalog. */
    async unlinkItem( owner: CatalogOwner, topicId: string, itemId: string ): Promise<void> {
        await this.findOrFail( owner, topicId );

        const { affected } = await this.dataSource.getRepository( TopicItem ).delete( { topicId, itemId } );

        if ( !affected ) {
            throw new NotFoundException( 'This item is not in this topic' );
        }
    }

    async reorderItems( owner: CatalogOwner, topicId: string, itemIds: string[] ): Promise<TopicItemView[]> {
        await this.findOrFail( owner, topicId );
        await this.dataSource.transaction( async ( manager ) => {
            const current = await manager.find( TopicItem, { select: { itemId: true }, where: { topicId } } );

            assertSameChildren( itemIds, current.map( ( link ) => link.itemId ) );
            await writePositions( manager, 'topic_items', itemIds, { column: 'topic_id', value: topicId }, 'item_id' );
        } );

        return this.findLinks( topicId );
    }

    private async findLinks( topicId: string ): Promise<TopicItemView[]> {
        const links = await this.dataSource.getRepository( TopicItem ).find( {
            where: { topicId },
            relations: { item: true },
            order: { position: 'ASC', createdAt: 'ASC' },
        } );

        return links.map( toTopicItemView );
    }
}
