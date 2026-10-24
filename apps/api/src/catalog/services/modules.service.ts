import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { LearningModule } from '@studylog/database';
import type { CreateLearningModuleRequest, UpdateLearningModuleRequest } from '@studylog/schemas';
import { DataSource } from 'typeorm';

import type { CatalogOwner } from '../catalog.helpers.js';
import {
    assertDeletable,
    assertSameChildren,
    defaultStatus,
    nextPosition,
    ownedBy,
    saveUnique,
    toSlug,
    writePositions,
} from '../catalog.helpers.js';
import { LearningPathsService } from './learning-paths.service.js';

const slugTaken = ( slug: string ) => `This learning path already has a module with slug "${slug}"`;

@Injectable()
export class ModulesService {
    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly learningPathsService: LearningPathsService,
    ) {}

    /** A module in one of this owner's paths; any other module is "not found". */
    async findOrFail( owner: CatalogOwner, id: string ): Promise<LearningModule> {
        const module = await this.dataSource.getRepository( LearningModule ).findOneBy( {
            id,
            learningPath: { organizationId: ownedBy( owner ) },
        } );

        if ( !module ) {
            throw new NotFoundException( 'Module not found' );
        }

        return module;
    }

    async create(
        owner: CatalogOwner,
        learningPathId: string,
        dto: CreateLearningModuleRequest,
    ): Promise<LearningModule> {
        await this.learningPathsService.findOrFail( owner, learningPathId );

        const slug = dto.slug ?? toSlug( dto.title );

        return saveUnique(
            () => this.dataSource.transaction( async ( manager ) =>
                manager.save( manager.create( LearningModule, {
                    status: defaultStatus( owner ),
                    ...dto,
                    slug,
                    learningPathId,
                    position: await nextPosition( manager, LearningModule, { learningPathId } ),
                } ) ) ),
            slugTaken( slug ),
        );
    }

    async update( owner: CatalogOwner, id: string, dto: UpdateLearningModuleRequest ): Promise<LearningModule> {
        const module = await this.findOrFail( owner, id );

        return saveUnique(
            () => this.dataSource.getRepository( LearningModule ).save( Object.assign( module, dto ) ),
            slugTaken( dto.slug ?? module.slug ),
        );
    }

    /** Deletes a module and its topics. Items stay in the catalog, only their links go. */
    async remove( owner: CatalogOwner, id: string ): Promise<void> {
        const module = await this.findOrFail( owner, id );

        assertDeletable( owner, module, 'module' );
        await this.dataSource.getRepository( LearningModule ).remove( module );
    }

    async reorder( owner: CatalogOwner, learningPathId: string, ids: string[] ): Promise<LearningModule[]> {
        await this.learningPathsService.findOrFail( owner, learningPathId );

        return this.dataSource.transaction( async ( manager ) => {
            const current = await manager.find( LearningModule, { select: { id: true }, where: { learningPathId } } );

            assertSameChildren( ids, current.map( ( module ) => module.id ) );
            await writePositions( manager, 'modules', ids, { column: 'learning_path_id', value: learningPathId } );

            return manager.find( LearningModule, { where: { learningPathId }, order: { position: 'ASC' } } );
        } );
    }
}
