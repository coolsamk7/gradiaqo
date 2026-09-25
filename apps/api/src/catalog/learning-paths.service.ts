import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Enrollment, LearningPath, Organization, PathVisibility } from '@studylog/database';
import type { CreateLearningPathRequest, LearningPathTree, UpdateLearningPathRequest } from '@studylog/schemas';
import { DataSource } from 'typeorm';

import type { CatalogOwner } from './catalog.helpers.js';
import {
    assertDeletable,
    assertSameChildren,
    defaultStatus,
    nextPosition,
    ownedBy,
    saveUnique,
    toSlug,
    writePositions,
} from './catalog.helpers.js';
import { CatalogTreeService } from './catalog-tree.service.js';

const slugTaken = ( slug: string ) => `A learning path with slug "${slug}" already exists here`;

/** Learning paths of one catalog: the global one (owner null) or an organization's own. */
@Injectable()
export class LearningPathsService {
    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly catalogTree: CatalogTreeService,
    ) {}

    list( owner: CatalogOwner ): Promise<LearningPath[]> {
        return this.dataSource.getRepository( LearningPath ).find( {
            where: { organizationId: ownedBy( owner ) },
            order: { position: 'ASC', createdAt: 'ASC' },
        } );
    }

    /** A path of this owner's catalog; any other path is "not found". */
    async findOrFail( owner: CatalogOwner, id: string ): Promise<LearningPath> {
        const path = await this.dataSource.getRepository( LearningPath ).findOneBy( {
            id,
            organizationId: ownedBy( owner ),
        } );

        if ( !path ) {
            throw new NotFoundException( 'Learning path not found' );
        }

        return path;
    }

    /** In a personal workspace, the creator is enrolled right away so the path shows on their dashboard. */
    async create( owner: CatalogOwner, dto: CreateLearningPathRequest, userId: string ): Promise<LearningPath> {
        const slug = dto.slug ?? toSlug( dto.title );
        const organization = await this.findOrganization( owner );
        const visibility = resolveVisibility( organization, dto.visibility ) ?? defaultVisibility( owner );

        return saveUnique(
            () => this.dataSource.transaction( async ( manager ) => {
                const path = await manager.save( manager.create( LearningPath, {
                    status: defaultStatus( owner ),
                    ...dto,
                    slug,
                    visibility,
                    organizationId: owner,
                    createdById: userId,
                    position: await nextPosition( manager, LearningPath, { organizationId: ownedBy( owner ) } ),
                } ) );

                if ( organization?.isPersonal ) {
                    await manager.insert( Enrollment, {
                        userId,
                        learningPathId: path.id,
                        position: await nextPosition( manager, Enrollment, { userId } ),
                    } );
                }

                return path;
            } ),
            slugTaken( slug ),
        );
    }

    /** Changing the title keeps the slug, so URLs stay stable; send `slug` to change it. */
    async update( owner: CatalogOwner, id: string, dto: UpdateLearningPathRequest ): Promise<LearningPath> {
        const path = await this.findOrFail( owner, id );

        resolveVisibility( await this.findOrganization( owner ), dto.visibility );

        return saveUnique(
            () => this.dataSource.getRepository( LearningPath ).save( Object.assign( path, dto ) ),
            slugTaken( dto.slug ?? path.slug ),
        );
    }

    /**
     * Deletes the path and everything under it, including enrollments in it. Items stay in the catalog,
     * only their links go.
     */
    async remove( owner: CatalogOwner, id: string ): Promise<void> {
        const path = await this.findOrFail( owner, id );

        assertDeletable( owner, path, 'learning path' );
        await this.dataSource.getRepository( LearningPath ).remove( path );
    }

    async reorder( owner: CatalogOwner, ids: string[] ): Promise<LearningPath[]> {
        await this.dataSource.transaction( async ( manager ) => {
            const current = await manager.find( LearningPath, {
                select: { id: true },
                where: { organizationId: ownedBy( owner ) },
            } );

            assertSameChildren( ids, current.map( ( path ) => path.id ) );
            await writePositions( manager, 'learning_paths', ids, { column: 'organization_id', value: owner } );
        } );

        return this.list( owner );
    }

    /** The path with all its modules, topics and items (any status), each level in order. */
    async findTree( owner: CatalogOwner, id: string ): Promise<LearningPathTree> {
        await this.findOrFail( owner, id );

        const tree = await this.catalogTree.load( id, { publishedOnly: false } );

        if ( !tree ) {
            throw new NotFoundException( 'Learning path not found' );
        }

        return tree;
    }

    private async findOrganization( owner: CatalogOwner ): Promise<Organization | null> {
        return owner === null ? null : this.dataSource.getRepository( Organization ).findOneByOrFail( { id: owner } );
    }
}

function defaultVisibility( owner: CatalogOwner ): PathVisibility {
    return owner === null ? PathVisibility.Public : PathVisibility.Private;
}

/**
 * Global paths are always public (hide one by unpublishing it). A personal workspace's paths can be private or
 * public. A shared organization's paths are only for its members.
 */
function resolveVisibility(
    organization: Organization | null,
    requested: PathVisibility | undefined,
): PathVisibility | undefined {
    if ( requested === undefined ) {
        return undefined;
    }
    if ( !organization && requested === PathVisibility.Private ) {
        throw new BadRequestException( 'Global paths are always public; set the status to draft or archived to hide one' );
    }
    if ( organization && !organization.isPersonal && requested === PathVisibility.Public ) {
        throw new BadRequestException( 'Only paths in a personal workspace can be public; this organization\'s paths are for its members' );
    }

    return requested;
}
