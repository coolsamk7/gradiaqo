import { TypeboxValidationException } from '@gradiaqo/nestjs-typebox';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ItemType } from '@studylog/database';
import { AuditAction, Item } from '@studylog/database';
import { ItemDetails } from '@studylog/nestjs';
import type { CreateItemRequest, ListItemsQuery, ManagedItemPage, UpdateItemRequest } from '@studylog/schemas';
import { Repository } from 'typeorm';

import { AuditService } from '../../audit/services/audit.service.js';
import type { CatalogOwner } from '../catalog.helpers.js';
import { assertDeletable, defaultStatus, ownedBy, STATUS_AUDIT_ACTIONS } from '../catalog.helpers.js';

/** Study material of one catalog: the global one (owner null) or an organization's own. */
@Injectable()
export class ItemsService {
    constructor(
        @InjectRepository( Item ) private readonly items: Repository<Item>,
        private readonly audit: AuditService,
    ) {}

    /** Items matching the filters, by title, one page at a time. */
    async list(
        owner: CatalogOwner,
        { type, status, search, tag, limit = 50, offset = 0 }: ListItemsQuery,
    ): Promise<ManagedItemPage> {
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
        const usage: { itemId: string; topics: number }[] = items.length === 0
            ? []
            : await this.items.query(
                    `SELECT item_id AS "itemId", COUNT(*)::int AS topics FROM topic_items WHERE item_id = ANY($1) GROUP BY item_id`,
                    [ items.map( ( item ) => item.id ) ],
                );
        const topics = new Map( usage.map( ( row ) => [ row.itemId, row.topics ] ) );

        return { items: items.map( ( item ) => ( { ...item, topicCount: topics.get( item.id ) ?? 0 } ) ), total };
    }

    /** An item of this owner's catalog; any other item is "not found". */
    async findOrFail( owner: CatalogOwner, id: string ): Promise<Item> {
        const item = await this.items.findOneBy( { id, organizationId: ownedBy( owner ) } );

        if ( !item ) {
            throw new NotFoundException( 'Item not found' );
        }

        return item;
    }

    async create( owner: CatalogOwner, dto: CreateItemRequest, userId: string ): Promise<Item> {
        return this.items.save( this.items.create( {
            status: defaultStatus( owner ),
            ...dto,
            details: parseDetails( dto.type, dto.details ),
            organizationId: owner,
            createdById: userId,
        } ) );
    }

    /** In the global catalog, a status change by `actorId` goes in the audit log. */
    async update( owner: CatalogOwner, id: string, dto: UpdateItemRequest, actorId: string ): Promise<Item> {
        const item = await this.findOrFail( owner, id );
        const before = item.status;

        Object.assign( item, dto );
        if ( dto.details ) {
            item.details = parseDetails( item.type, dto.details );
        }

        const saved = await this.items.save( item );

        if ( owner === null && saved.status !== before ) {
            await this.audit.record( {
                actorId,
                action: STATUS_AUDIT_ACTIONS.item[saved.status],
                targetId: id,
                targetLabel: saved.title,
            } );
        }

        return saved;
    }

    /** Deletes an item, removing it from every topic it's linked to. Deleting a global one goes in the audit log. */
    async remove( owner: CatalogOwner, id: string, actorId: string ): Promise<void> {
        const item = await this.findOrFail( owner, id );
        const { title } = item;

        assertDeletable( owner, item, 'item' );
        await this.items.remove( item );
        if ( owner === null ) {
            await this.audit.record( { actorId, action: AuditAction.ItemDeleted, targetId: id, targetLabel: title } );
        }
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
