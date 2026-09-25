import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { CatalogStatus, Item, LearningPath, Membership, PathVisibility, Topic } from '@studylog/database';
import { Brackets, DataSource } from 'typeorm';

type PathAccess = Pick<LearningPath, 'status' | 'organizationId' | 'visibility'>;

/**
 * What a user may see of the catalog (to browse, enroll, track progress and log time). A path is visible when
 * it's published and it's global, public, or owned by one of the user's organizations; its content must be
 * published too.
 */
@Injectable()
export class CatalogAccessService {
    constructor( @InjectDataSource() private readonly dataSource: DataSource ) {}

    /** Visible paths: the global catalog in its order, then the user's organizations' paths, then public ones. */
    async visiblePaths( userId: string ): Promise<LearningPath[]> {
        const organizationIds = await this.organizationIdsOf( userId );
        const paths = await this.dataSource.getRepository( LearningPath )
            .createQueryBuilder( 'path' )
            .where( 'path.status = :published', { published: CatalogStatus.Published } )
            .andWhere( new Brackets( ( visible ) => visible
                .where( 'path.organization_id IS NULL' )
                .orWhere( 'path.visibility = :public', { public: PathVisibility.Public } )
                .orWhere( 'path.organization_id IN ( SELECT organization_id FROM memberships WHERE user_id = :userId )', { userId } ) ) )
            .orderBy( 'path.position', 'ASC' )
            .addOrderBy( 'path.created_at', 'ASC' )
            .getMany();
        const rank = ( path: LearningPath ) => {
            if ( path.organizationId === null ) {
                return 0;
            }

            return organizationIds.has( path.organizationId ) ? 1 : 2;
        };

        return paths.sort( ( a, b ) => rank( a ) - rank( b ) );
    }

    async canSeePath( userId: string, path: PathAccess ): Promise<boolean> {
        if ( path.status !== CatalogStatus.Published ) {
            return false;
        }
        if ( path.organizationId === null || path.visibility === PathVisibility.Public ) {
            return true;
        }

        return ( await this.organizationIdsOf( userId ) ).has( path.organizationId );
    }

    /** A published topic whose module is published and whose path is visible. */
    async canSeeTopic( userId: string, topicId: string ): Promise<boolean> {
        const topic = await this.dataSource.getRepository( Topic ).findOne( {
            where: { id: topicId, status: CatalogStatus.Published, module: { status: CatalogStatus.Published } },
            relations: { module: { learningPath: true } },
        } );

        return topic ? this.canSeePath( userId, topic.module.learningPath ) : false;
    }

    /**
     * A published item that's global, owned by one of the user's organizations, or part of a published public
     * path (someone's shared personal path).
     */
    async canSeeItem( userId: string, itemId: string ): Promise<boolean> {
        const item = await this.dataSource.getRepository( Item ).findOneBy( {
            id: itemId,
            status: CatalogStatus.Published,
        } );

        if ( !item ) {
            return false;
        }
        if ( item.organizationId === null || ( await this.organizationIdsOf( userId ) ).has( item.organizationId ) ) {
            return true;
        }

        const [ inPublicPath ]: unknown[] = await this.dataSource.query(
            `SELECT 1 FROM topic_items ti
             JOIN topics t ON t.id = ti.topic_id
             JOIN modules m ON m.id = t.module_id
             JOIN learning_paths p ON p.id = m.learning_path_id
             WHERE ti.item_id = $1 AND p.visibility = $2 AND p.status = $3
             LIMIT 1`,
            [ itemId, PathVisibility.Public, CatalogStatus.Published ],
        );

        return Boolean( inPublicPath );
    }

    private async organizationIdsOf( userId: string ): Promise<Set<string>> {
        const memberships = await this.dataSource.getRepository( Membership ).find( {
            select: { organizationId: true },
            where: { userId },
        } );

        return new Set( memberships.map( ( membership ) => membership.organizationId ) );
    }
}
