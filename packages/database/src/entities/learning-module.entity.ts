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

import { LearningPath } from './learning-path.entity.js';
import { Topic } from './topic.entity.js';

/** A section of a learning path, e.g. "Arrays & Hashing". Named to avoid confusion with Nest modules. */
@Entity( 'modules' )
@Unique( 'uq_modules_path_slug', [ 'learningPathId', 'slug' ] )
export class LearningModule {
    @PrimaryGeneratedColumn( 'uuid' )
    id: string;

    // Covered by the unique (path, slug) index.
    @Column( { name: 'learning_path_id', type: 'uuid' } )
    learningPathId: string;

    @ManyToOne( () => LearningPath, ( path ) => path.modules, { onDelete: 'CASCADE' } )
    @JoinColumn( { name: 'learning_path_id' } )
    learningPath: Relation<LearningPath>;

    @Column( { type: 'varchar', length: 200 } )
    title: string;

    // Unique within its path.
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

    @OneToMany( () => Topic, ( topic ) => topic.module )
    topics: Relation<Topic[]>;

    @CreateDateColumn( { name: 'created_at', type: 'timestamptz' } )
    createdAt: Date;

    @UpdateDateColumn( { name: 'updated_at', type: 'timestamptz' } )
    updatedAt: Date;
}
