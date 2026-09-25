import { TypeboxValidationException } from '@gradiaqo/nestjs-typebox';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ItemType } from '@studylog/database';
import { Item } from '@studylog/database';
import { ItemDetails } from '@studylog/nestjs';
import type { CreateItemRequest, ItemPage, ListItemsQuery, UpdateItemRequest } from '@studylog/schemas';
import { Repository } from 'typeorm';

import type { CatalogOwner } from './catalog.helpers.js';
import { assertDeletable, defaultStatus, ownedBy } from './catalog.helpers.js';

/** Study material of one catalog: the global one (owner null) or an organization's own. */
@Injectable()
export class ItemsService {
    constructor( @InjectRepository( Item ) private readonly items: Repository<Item> ) {}

    /** Items matching the filters, by title, one page at a time. */
    async list(
        owner: CatalogOwner,
        { type, status, search, tag, limit = 50, offset = 0 }: ListItemsQuery,
    ): Promise<ItemPage> {
        const query = this.items
            .createQueryBuilder( 'item' )
            .where( owner === null ? 'item.organization_id IS NULL' : 'item.organization_id = :owner', { owner } )
            .orderBy( 'item.title', 'ASC' )
            .addOrderBy( 'item.id', 'ASC' )
            .take( limit )
            .skip( offset );

        if ( type ) {
            query.andWhere( 'item.type = :type', { type } );
        }
        if ( status ) {
            query.andWhere( 'item.status = :status', { status } );
        }
        if ( tag ) {
            query.andWhere( ':tag = ANY( item.tags )', { tag } );
        }
        if ( search ) {
            // Match the text literally: % and _ are wildcards in ILIKE.
            query.andWhere( 'item.title ILIKE :search', { search: `%${search.replace( /[\\%_]/g, '\\$&' )}%` } );
        }

        const [ items, total ] = await query.getManyAndCount();

        return { items, total };
    }

    /** An item of this owner's catalog; any other item is "not found". */
    async findOrFail( owner: CatalogOwner, id: string ): Promise<Item> {
        const item = await this.items.findOneBy( { id, organizationId: ownedBy( owner ) } );

        if ( !item ) {
            throw new NotFoundException( 'Item not found' );
        }

        return item;
    }

    create( owner: CatalogOwner, dto: CreateItemRequest, userId: string ): Promise<Item> {
        return this.items.save( this.items.create( {
            status: defaultStatus( owner ),
            ...dto,
            details: parseDetails( dto.type, dto.details ),
            organizationId: owner,
            createdById: userId,
        } ) );
    }

    async update( owner: CatalogOwner, id: string, dto: UpdateItemRequest ): Promise<Item> {
        const item = await this.findOrFail( owner, id );

        Object.assign( item, dto );
        if ( dto.details ) {
            item.details = parseDetails( item.type, dto.details );
        }

        return this.items.save( item );
    }

    /** Deletes an item, removing it from every topic it's linked to. */
    async remove( owner: CatalogOwner, id: string ): Promise<void> {
        const item = await this.findOrFail( owner, id );

        assertDeletable( owner, item, 'item' );
        await this.items.remove( item );
    }
}

/** Checks `details` against the schema for the item's type; errors point at `/details/...` like other body errors. */
function parseDetails( type: ItemType, details: Record<string, unknown> ): Record<string, unknown> {
    const result = ItemDetails[type].safeParse( details );

    if ( result.issues ) {
        throw new TypeboxValidationException(
            'body',
            result.issues.map( ( issue ) => ( { ...issue, path: `/details${issue.path}` } ) ),
        );
    }

    return result.value;
}
