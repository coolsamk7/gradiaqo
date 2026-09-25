import type { Relation } from 'typeorm';
import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryColumn,
} from 'typeorm';

import { Item } from './item.entity.js';
import { Topic } from './topic.entity.js';

/** Places an item in a topic, at a position. The same item can be placed in many topics. */
@Entity( 'topic_items' )
export class TopicItem {
    @PrimaryColumn( { name: 'topic_id', type: 'uuid' } )
    topicId: string;

    @ManyToOne( () => Topic, ( topic ) => topic.topicItems, { onDelete: 'CASCADE' } )
    @JoinColumn( { name: 'topic_id' } )
    topic: Relation<Topic>;

    // The primary key starts with topic_id, so lookups by item need their own index.
    @Index()
    @PrimaryColumn( { name: 'item_id', type: 'uuid' } )
    itemId: string;

    @ManyToOne( () => Item, { onDelete: 'CASCADE' } )
    @JoinColumn( { name: 'item_id' } )
    item: Relation<Item>;

    @Column( { type: 'int', default: 0 } )
    position: number;

    // Extra material: not needed to complete the topic.
    @Column( { name: 'is_optional', type: 'boolean', default: false } )
    isOptional: boolean;

    @CreateDateColumn( { name: 'created_at', type: 'timestamptz' } )
    createdAt: Date;
}
