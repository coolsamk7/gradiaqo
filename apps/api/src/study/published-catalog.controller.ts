import { TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import type { AccessTokenPayload } from '@studylog/casl';
import { CatalogStatus, Enrollment } from '@studylog/database';
import { ListItemsQueryParams, ListPublishedPathsQueryParams, Responses } from '@studylog/nestjs';
import type {
    ItemPage,
    ListItemsQuery,
    ListPublishedPathsQuery,
    PathContents,
    PublishedPath,
    PublishedPathSummary,
} from '@studylog/schemas';
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
            + 'and paths other users made public. Filter with `source` (official, mine, organizations, community) '
            + 'and `search` (title).',
    } )
    @TypeboxResponse( Responses.PublishedPathList )
    @ApiBadRequestResponse( { description: 'Invalid filters' } )
    async list(
        @CurrentUser() user: AccessTokenPayload,
        @Query( { schema: ListPublishedPathsQueryParams } ) query: ListPublishedPathsQuery,
    ): Promise<PublishedPathSummary[]> {
        const paths = await this.catalogAccess.visiblePaths( user.sub, query );
        const enrollmentIds = await this.enrollmentIdsByPath( user.sub );
        const contents = await this.contentsByPath( paths.map( ( path ) => path.id ) );

        return paths.map( ( path ) => ( {
            ...path,
            enrollmentId: enrollmentIds.get( path.id ) ?? null,
            contents: contents.get( path.id ) ?? { modules: 0, items: 0, estimatedMinutes: 0 },
        } ) );
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

        return {
            ...tree,
            ...( await this.catalogAccess.originOfPath( pathId ) ),
            enrollmentId: ( await this.enrollmentIdsByPath( user.sub ) ).get( pathId ) ?? null,
            contents: contentsOfTree( tree ),
        };
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

    /** Published modules, items and estimated minutes of each path, in one query. */
    private async contentsByPath( pathIds: string[] ): Promise<Map<string, PathContents>> {
        if ( pathIds.length === 0 ) {
            return new Map();
        }

        const rows: ( PathContents & { pathId: string } )[] = await this.dataSource.query(
            `WITH content AS (
                 SELECT DISTINCT m.learning_path_id AS path_id, m.id AS module_id, i.id AS item_id, i.estimated_minutes
                 FROM modules m
                 LEFT JOIN topics t ON t.module_id = m.id AND t.status = 'published'
                 LEFT JOIN topic_items ti ON ti.topic_id = t.id
                 LEFT JOIN items i ON i.id = ti.item_id AND i.status = 'published'
                 WHERE m.learning_path_id = ANY( $1 ) AND m.status = 'published'
             ), path_items AS (
                 SELECT DISTINCT path_id, item_id, estimated_minutes FROM content WHERE item_id IS NOT NULL
             )
             SELECT c.path_id AS "pathId",
                    COUNT( DISTINCT c.module_id )::int AS modules,
                    ( SELECT COUNT( * )::int FROM path_items p WHERE p.path_id = c.path_id ) AS items,
                    ( SELECT COALESCE( SUM( p.estimated_minutes ), 0 )::int FROM path_items p WHERE p.path_id = c.path_id )
                        AS "estimatedMinutes"
             FROM content c
             GROUP BY c.path_id`,
            [ pathIds ],
        );

        return new Map( rows.map( ( { pathId, ...contents } ) => [ pathId, contents ] ) );
    }

    private async enrollmentIdsByPath( userId: string ): Promise<Map<string, string>> {
        const enrollments = await this.dataSource.getRepository( Enrollment ).find( {
            select: { id: true, learningPathId: true },
            where: { userId },
        } );

        return new Map( enrollments.map( ( enrollment ) => [ enrollment.learningPathId, enrollment.id ] ) );
    }
}

/** The same counts as contentsByPath, from a loaded tree of published content. */
interface ContentTree { modules: { topics: { items: { id: string; estimatedMinutes: number | null }[] }[] }[] }

function contentsOfTree( tree: ContentTree ): PathContents {
    const items = new Map( tree.modules
        .flatMap( ( module ) => module.topics.flatMap( ( topic ) => topic.items ) )
        .map( ( item ) => [ item.id, item.estimatedMinutes ?? 0 ] ) );
    const estimatedMinutes = [ ...items.values() ].reduce( ( sum, minutes ) => sum + minutes, 0 );

    return { modules: tree.modules.length, items: items.size, estimatedMinutes };
}
