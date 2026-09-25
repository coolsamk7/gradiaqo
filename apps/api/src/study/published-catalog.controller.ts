import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import type { AccessTokenPayload } from '@studylog/casl';
import { CatalogStatus, Enrollment } from '@studylog/database';
import { ListItemsQueryParams, Responses } from '@studylog/nestjs';
import type { ItemPage, ListItemsQuery, PublishedPath, PublishedPathSummary } from '@studylog/schemas';
import { DataSource } from 'typeorm';

import { CurrentUser } from '../auth/auth.guard.js';
import { Authenticated } from '../auth/authenticated.decorator.js';
import { CatalogAccessService } from '../catalog/catalog-access.service.js';
import { CatalogTreeService } from '../catalog/catalog-tree.service.js';
import { ItemsService } from '../catalog/items.service.js';

/** The catalog as users browse it: official paths, their organizations' paths and public ones. */
@ApiTags( 'catalog' )
@Controller( 'catalog' )
@Authenticated()
export class PublishedCatalogController {
    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly catalogTree: CatalogTreeService,
        private readonly catalogAccess: CatalogAccessService,
        private readonly itemsService: ItemsService,
    ) {}

    @Get( 'paths' )
    @ApiOperation( {
        summary: 'Learning paths you can follow, with your enrollment in each (if any)',
        description: 'Published paths of the global catalog, of your organizations (including your personal workspace), '
            + 'and paths other users made public. `organizationId` null means an official path.',
    } )
    @TypeboxResponse( Responses.PublishedPathList )
    async list( @CurrentUser() user: AccessTokenPayload ): Promise<PublishedPathSummary[]> {
        const paths = await this.catalogAccess.visiblePaths( user.sub );
        const enrollmentIds = await this.enrollmentIdsByPath( user.sub );

        return paths.map( ( path ) => ( { ...path, enrollmentId: enrollmentIds.get( path.id ) ?? null } ) );
    }

    @Get( 'paths/:pathId' )
    @ApiOperation( { summary: 'A learning path you can see, with its published modules, topics and items' } )
    @TypeboxResponse( Responses.PublishedPath )
    @ApiNotFoundResponse( { description: 'Learning path not found, not published, or not visible to you' } )
    async findOne(
        @CurrentUser() user: AccessTokenPayload,
        @Param( 'pathId', ParseUUIDPipe ) pathId: string,
    ): Promise<PublishedPath> {
        const tree = await this.catalogTree.load( pathId, { publishedOnly: true } );

        if ( !tree || !( await this.catalogAccess.canSeePath( user.sub, tree ) ) ) {
            throw new NotFoundException( 'Learning path not found' );
        }

        return { ...tree, enrollmentId: ( await this.enrollmentIdsByPath( user.sub ) ).get( pathId ) ?? null };
    }

    @Get( 'items' )
    @ApiOperation( {
        summary: 'Search published items of the global catalog',
        description: 'To find material to link into your own paths without re-entering it.',
    } )
    @TypeboxResponse( Responses.ItemPage )
    @ApiBadRequestResponse( { description: 'Invalid filters' } )
    searchItems( @Query( { schema: ListItemsQueryParams } ) query: ListItemsQuery ): Promise<ItemPage> {
        return this.itemsService.list( null, { ...query, status: CatalogStatus.Published } );
    }

    private async enrollmentIdsByPath( userId: string ): Promise<Map<string, string>> {
        const enrollments = await this.dataSource.getRepository( Enrollment ).find( {
            select: { id: true, learningPathId: true },
            where: { userId },
        } );

        return new Map( enrollments.map( ( enrollment ) => [ enrollment.learningPathId, enrollment.id ] ) );
    }
}
