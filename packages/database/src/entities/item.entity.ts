import { CatalogStatus, Difficulty, ItemType } from '@studylog/schemas/enums';
import type { Relation } from 'typeorm';
import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

import { Organization } from './organization.entity.js';
import { User } from './user.entity.js';

/**
 * A piece of study material of any kind (problem, article, video, ...). Stored once and linked to any
 * number of topics, so progress on it counts everywhere it appears.
 */
@Entity( 'items' )
export class Item {
    @PrimaryGeneratedColumn( 'uuid' )
    id: string;

    // Null: the global catalog. Set: owned by an organization; only linked into that organization's topics.
    @Index()
    @Column( { name: 'organization_id', type: 'uuid', nullable: true } )
    organizationId: string | null;

    @ManyToOne( () => Organization, { onDelete: 'CASCADE', nullable: true } )
    @JoinColumn( { name: 'organization_id' } )
    organization: Relation<Organization> | null;

    @Index()
    @Column( { type: 'enum', enum: ItemType, enumName: 'item_type' } )
    type: ItemType;

    @Column( { type: 'varchar', length: 300 } )
    title: string;

    @Column( { type: 'text', nullable: true } )
    description: string | null;

    @Column( { type: 'enum', enum: Difficulty, enumName: 'difficulty', nullable: true } )
    difficulty: Difficulty | null;

    @Column( { name: 'estimated_minutes', type: 'int', nullable: true } )
    estimatedMinutes: number | null;

    @Column( { type: 'text', array: true, default: () => '\'{}\'' } )
    tags: string[];

    // Fields specific to the item type, validated by `ItemDetailsSchemas` in @studylog/schemas.
    @Column( { type: 'jsonb', default: () => '\'{}\'' } )
    details: Record<string, unknown>;

    @Column( {
        type: 'enum',
        enum: CatalogStatus,
        enumName: 'catalog_status',
        default: CatalogStatus.Draft,
    } )
    status: CatalogStatus;

    @Column( { name: 'created_by_id', type: 'uuid', nullable: true } )
    createdById: string | null;

    @ManyToOne( () => User, { onDelete: 'SET NULL', nullable: true } )
    @JoinColumn( { name: 'created_by_id' } )
    createdBy: Relation<User> | null;

    @CreateDateColumn( { name: 'created_at', type: 'timestamptz' } )
    createdAt: Date;

    @UpdateDateColumn( { name: 'updated_at', type: 'timestamptz' } )
    updatedAt: Date;
}
