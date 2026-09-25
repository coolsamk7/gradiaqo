import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ItemProgress, ProgressStatus } from '@studylog/database';
import type {
    ItemProgress as ItemProgressView,
    ItemProgressPage,
    ListProgressQuery,
} from '@studylog/schemas';
import { DataSource } from 'typeorm';

import { CatalogAccessService } from '../catalog/catalog-access.service.js';

@Injectable()
export class ProgressService {
    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly catalogAccess: CatalogAccessService,
    ) {}

    /** The user's items with any progress, most recently updated first. */
    async list( userId: string, { status, limit = 50, offset = 0 }: ListProgressQuery ): Promise<ItemProgressPage> {
        if ( status === ProgressStatus.NotStarted ) {
            // Not-started items have no row; there's nothing to list.
            return { items: [], total: 0 };
        }

        const [ rows, total ] = await this.dataSource.getRepository( ItemProgress ).findAndCount( {
            where: { userId, ...( status && { status } ) },
            relations: { item: true },
            order: { updatedAt: 'DESC', itemId: 'ASC' },
            take: limit,
            skip: offset,
        } );

        return { items: rows.map( ( row ) => ( { ...toView( row.itemId, row ), item: row.item } ) ), total };
    }

    async get( userId: string, itemId: string ): Promise<ItemProgressView> {
        await this.assertItemVisible( userId, itemId );

        return toView( itemId, await this.dataSource.getRepository( ItemProgress ).findOneBy( { userId, itemId } ) );
    }

    /**
     * Records the user's status on an item. `startedAt` is set the first time it moves past not started,
     * `completedAt` the first time it's done (or marked for revision); both are kept on later changes.
     * `not_started` removes the record.
     */
    async set( userId: string, itemId: string, status: ProgressStatus ): Promise<ItemProgressView> {
        await this.assertItemVisible( userId, itemId );

        const repository = this.dataSource.getRepository( ItemProgress );

        if ( status === ProgressStatus.NotStarted ) {
            await repository.delete( { userId, itemId } );

            return toView( itemId, null );
        }

        const existing = await repository.findOneBy( { userId, itemId } );
        const now = new Date();
        const isCompleted = status === ProgressStatus.Done || status === ProgressStatus.Revise;

        return toView( itemId, await repository.save( repository.create( {
            userId,
            itemId,
            status,
            startedAt: existing?.startedAt ?? now,
            completedAt: existing?.completedAt ?? ( isCompleted ? now : null ),
        } ) ) );
    }

    /** Users can only track items they can see. */
    private async assertItemVisible( userId: string, itemId: string ): Promise<void> {
        if ( !( await this.catalogAccess.canSeeItem( userId, itemId ) ) ) {
            throw new NotFoundException( 'Item not found' );
        }
    }
}

function toView( itemId: string, row: ItemProgress | null ): ItemProgressView {
    return {
        itemId,
        status: row?.status ?? ProgressStatus.NotStarted,
        startedAt: row?.startedAt ?? null,
        completedAt: row?.completedAt ?? null,
        updatedAt: row?.updatedAt ?? null,
    };
}
