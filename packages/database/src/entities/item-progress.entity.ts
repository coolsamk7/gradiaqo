import { ProgressStatus } from '@studylog/schemas/enums';
import type { Relation } from 'typeorm';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import { Item } from './item.entity.js';
import { User } from './user.entity.js';

/**
 * A user's status on one item. Per item, not per path, so an item done once shows as done in every path and
 * topic it appears in. No row means not started.
 */
@Entity( 'item_progress' )
export class ItemProgress {
    @PrimaryColumn( { name: 'user_id', type: 'uuid' } )
    userId: string;

    @ManyToOne( () => User, { onDelete: 'CASCADE' } )
    @JoinColumn( { name: 'user_id' } )
    user: Relation<User>;

    @Index()
    @PrimaryColumn( { name: 'item_id', type: 'uuid' } )
    itemId: string;

    @ManyToOne( () => Item, { onDelete: 'CASCADE' } )
    @JoinColumn( { name: 'item_id' } )
    item: Relation<Item>;

    @Column( {
        type: 'enum',
        enum: ProgressStatus,
        enumName: 'progress_status',
    } )
    status: ProgressStatus;

    @Column( { name: 'started_at', type: 'timestamptz', nullable: true } )
    startedAt: Date | null;

    // First time it was marked done; kept when it's later marked for revision.
    @Column( { name: 'completed_at', type: 'timestamptz', nullable: true } )
    completedAt: Date | null;

    @UpdateDateColumn( { name: 'updated_at', type: 'timestamptz' } )
    updatedAt: Date;
}
