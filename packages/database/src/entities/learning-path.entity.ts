import { CatalogStatus, PathVisibility } from '@studylog/schemas/enums';
import type { Relation } from 'typeorm';
import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

import { LearningModule } from './learning-module.entity.js';
import { Organization } from './organization.entity.js';
import { User } from './user.entity.js';

/** Top of the catalog, e.g. "Data Structures & Algorithms". Holds ordered modules. */
@Entity( 'learning_paths' )
// Slugs are unique within the global catalog, and within each organization.
@Index( 'uq_learning_paths_global_slug', [ 'slug' ], { unique: true, where: '"organization_id" IS NULL' } )
@Index( 'uq_learning_paths_organization_slug', [ 'organizationId', 'slug' ], {
    unique: true,
    where: '"organization_id" IS NOT NULL',
} )
export class LearningPath {
    @PrimaryGeneratedColumn( 'uuid' )
    id: string;

    // Null: the global catalog, managed by superadmins. Set: owned by an organization, e.g. a personal workspace.
    // Indexed by the (organization, slug) index.
    @Column( { name: 'organization_id', type: 'uuid', nullable: true } )
    organizationId: string | null;

    @ManyToOne( () => Organization, { onDelete: 'CASCADE', nullable: true } )
    @JoinColumn( { name: 'organization_id' } )
    organization: Relation<Organization> | null;

    @Column( { type: 'varchar', length: 200 } )
    title: string;

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

    // Global paths are always public. See `PathVisibility`.
    @Column( {
        type: 'enum',
        enum: PathVisibility,
        enumName: 'path_visibility',
        default: PathVisibility.Private,
    } )
    visibility: PathVisibility;

    @Column( { type: 'int', default: 0 } )
    position: number;

    @Column( { name: 'created_by_id', type: 'uuid', nullable: true } )
    createdById: string | null;

    @ManyToOne( () => User, { onDelete: 'SET NULL', nullable: true } )
    @JoinColumn( { name: 'created_by_id' } )
    createdBy: Relation<User> | null;

    @OneToMany( () => LearningModule, ( module ) => module.learningPath )
    modules: Relation<LearningModule[]>;

    @CreateDateColumn( { name: 'created_at', type: 'timestamptz' } )
    createdAt: Date;

    @UpdateDateColumn( { name: 'updated_at', type: 'timestamptz' } )
    updatedAt: Date;
}
