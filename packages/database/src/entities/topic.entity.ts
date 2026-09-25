import { CatalogStatus } from '@studylog/schemas/enums';
import type { Relation } from 'typeorm';
import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from 'typeorm';

import { LearningModule } from './learning-module.entity.js';
import { TopicItem } from './topic-item.entity.js';

/** A subject inside a module, e.g. "Two Pointers". Items are linked to it through `topic_items`. */
@Entity( 'topics' )
@Unique( 'uq_topics_module_slug', [ 'moduleId', 'slug' ] )
export class Topic {
    @PrimaryGeneratedColumn( 'uuid' )
    id: string;

    // Covered by the unique (module, slug) index.
    @Column( { name: 'module_id', type: 'uuid' } )
    moduleId: string;

    @ManyToOne( () => LearningModule, ( module ) => module.topics, { onDelete: 'CASCADE' } )
    @JoinColumn( { name: 'module_id' } )
    module: Relation<LearningModule>;

    @Column( { type: 'varchar', length: 200 } )
    title: string;

    // Unique within its module.
    @Column( { type: 'varchar', length: 120 } )
    slug: string;

    @Column( { type: 'text', nullable: true } )
    description: string | null;

    @Column( {
        type: 'enum',
        enum: CatalogStatus,
        enumName: 'catalog_status',
        default: CatalogStatus.Draft,
    } )
    status: CatalogStatus;

    @Column( { type: 'int', default: 0 } )
    position: number;

    @OneToMany( () => TopicItem, ( link ) => link.topic )
    topicItems: Relation<TopicItem[]>;

    @CreateDateColumn( { name: 'created_at', type: 'timestamptz' } )
    createdAt: Date;

    @UpdateDateColumn( { name: 'updated_at', type: 'timestamptz' } )
    updatedAt: Date;
}
