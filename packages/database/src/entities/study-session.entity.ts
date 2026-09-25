import type { Relation } from 'typeorm';
import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

import { Item } from './item.entity.js';
import { Topic } from './topic.entity.js';
import { User } from './user.entity.js';

/** Time a user spent studying a topic and/or an item, with optional notes. */
@Entity( 'study_sessions' )
@Index( 'idx_study_sessions_user_started', [ 'userId', 'startedAt' ] )
@Check( 'chk_study_sessions_duration', '"duration_minutes" > 0' )
export class StudySession {
    @PrimaryGeneratedColumn( 'uuid' )
    id: string;

    // Covered by the (user, started_at) index.
    @Column( { name: 'user_id', type: 'uuid' } )
    userId: string;

    @ManyToOne( () => User, { onDelete: 'CASCADE' } )
    @JoinColumn( { name: 'user_id' } )
    user: Relation<User>;

    // Kept (as null) if the topic or item is deleted, so the time still counts in stats.
    @Index()
    @Column( { name: 'topic_id', type: 'uuid', nullable: true } )
    topicId: string | null;

    @ManyToOne( () => Topic, { onDelete: 'SET NULL', nullable: true } )
    @JoinColumn( { name: 'topic_id' } )
    topic: Relation<Topic> | null;

    @Index()
    @Column( { name: 'item_id', type: 'uuid', nullable: true } )
    itemId: string | null;

    @ManyToOne( () => Item, { onDelete: 'SET NULL', nullable: true } )
    @JoinColumn( { name: 'item_id' } )
    item: Relation<Item> | null;

    @Column( { name: 'started_at', type: 'timestamptz' } )
    startedAt: Date;

    @Column( { name: 'duration_minutes', type: 'int' } )
    durationMinutes: number;

    @Column( { type: 'text', nullable: true } )
    notes: string | null;

    @CreateDateColumn( { name: 'created_at', type: 'timestamptz' } )
    createdAt: Date;

    @UpdateDateColumn( { name: 'updated_at', type: 'timestamptz' } )
    updatedAt: Date;
}
