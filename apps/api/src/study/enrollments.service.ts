import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
    Enrollment,
    EnrollmentOrder,
    EnrollmentRule,
    ItemProgress,
    OrderParentType,
    RuleScope,
} from '@studylog/database';
import type {
    CreateEnrollmentRequest,
    Enrollment as EnrollmentView,
    EnrollmentDetail,
    EnrollmentRule as EnrollmentRuleView,
    EnrollmentStatus,
    ProgressStatus,
} from '@studylog/schemas';
import type { EntityManager } from 'typeorm';
import { DataSource, In } from 'typeorm';

import { assertSameChildren, nextPosition, saveUnique, writePositions } from '../catalog/catalog.helpers.js';
import { CatalogAccessService } from '../catalog/catalog-access.service.js';
import type { CatalogModuleNode, CatalogTree } from '../catalog/catalog-tree.service.js';
import { CatalogTreeService } from '../catalog/catalog-tree.service.js';
import { applyOrders, itemIdsOf, selectContent, withProgress } from './learning-tree.js';

@Injectable()
export class EnrollmentsService {
    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly catalogTree: CatalogTreeService,
        private readonly catalogAccess: CatalogAccessService,
    ) {}

    /** The user's enrollments in dashboard order, each with its progress. */
    async list( userId: string ): Promise<EnrollmentView[]> {
        const enrollments = await this.dataSource.getRepository( Enrollment ).find( {
            where: { userId },
            relations: { learningPath: true, rules: true, orders: true },
            order: { position: 'ASC', createdAt: 'ASC' },
        } );

        return Promise.all( enrollments.map( async ( enrollment ) => {
            const { rules: _rules, orders: _orders, modules: _modules, ...summary } = await this.build( enrollment );

            return summary;
        } ) );
    }

    async detail( userId: string, id: string ): Promise<EnrollmentDetail> {
        return this.build( await this.findOrFail( userId, id ) );
    }

    async create( userId: string, dto: CreateEnrollmentRequest ): Promise<EnrollmentDetail> {
        const tree = await this.catalogTree.load( dto.learningPathId, { publishedOnly: true } );

        if ( !tree || !( await this.catalogAccess.canSeePath( userId, tree ) ) ) {
            throw new NotFoundException( 'Learning path not found' );
        }

        const rules = dto.rules ?? [];

        assertValidRules( tree, rules );

        const id = await saveUnique(
            () => this.dataSource.transaction( async ( manager ) => {
                const enrollment = await manager.save( manager.create( Enrollment, {
                    userId,
                    learningPathId: tree.id,
                    position: await nextPosition( manager, Enrollment, { userId } ),
                } ) );

                await insertRules( manager, enrollment.id, rules );

                return enrollment.id;
            } ),
            'You are already enrolled in this learning path',
        );

        return this.detail( userId, id );
    }

    async updateStatus( userId: string, id: string, status: EnrollmentStatus ): Promise<EnrollmentDetail> {
        await this.findOrFail( userId, id );
        await this.dataSource.getRepository( Enrollment ).update( { id }, { status } );

        return this.detail( userId, id );
    }

    /** Unenrolls. Progress and study sessions are kept, since they belong to items, not enrollments. */
    async remove( userId: string, id: string ): Promise<void> {
        const { affected } = await this.dataSource.getRepository( Enrollment ).delete( { id, userId } );

        if ( !affected ) {
            throw new NotFoundException( 'Enrollment not found' );
        }
    }

    /** Dashboard order: every enrollment id of the user, in the new order. */
    async reorder( userId: string, ids: string[] ): Promise<EnrollmentView[]> {
        await this.dataSource.transaction( async ( manager ) => {
            const current = await manager.find( Enrollment, { select: { id: true }, where: { userId } } );

            assertSameChildren( ids, current.map( ( enrollment ) => enrollment.id ) );
            await writePositions( manager, 'enrollments', ids, { column: 'user_id', value: userId } );
        } );

        return this.list( userId );
    }

    async replaceRules( userId: string, id: string, rules: EnrollmentRuleView[] ): Promise<EnrollmentDetail> {
        const enrollment = await this.findOrFail( userId, id );

        assertValidRules( await this.publishedTree( enrollment ), rules );
        await this.dataSource.transaction( async ( manager ) => {
            await manager.delete( EnrollmentRule, { enrollmentId: id } );
            await insertRules( manager, id, rules );
        } );

        return this.detail( userId, id );
    }

    /**
     * Sets the user's order for one parent's children. `ids` may list only some children (the rest follow in
     * the admin's order), but each must be a current child of that parent.
     */
    async setOrder(
        userId: string,
        id: string,
        parentType: OrderParentType,
        parentId: string,
        ids: string[],
    ): Promise<EnrollmentDetail> {
        const enrollment = await this.findOrFail( userId, id );
        const children = childIdsOf( await this.publishedTree( enrollment ), parentType, parentId );

        if ( !children ) {
            throw new NotFoundException( `No ${parentType} ${parentId} in this learning path` );
        }
        if ( ids.some( ( childId ) => !children.includes( childId ) ) ) {
            throw new BadRequestException( `ids must be children of this ${parentType}` );
        }

        await this.dataSource.getRepository( EnrollmentOrder ).upsert(
            { enrollmentId: id, parentType, parentId, orderedIds: ids },
            [ 'enrollmentId', 'parentType', 'parentId' ],
        );

        return this.detail( userId, id );
    }

    /** Goes back to the admin's order for one parent. */
    async clearOrder(
        userId: string,
        id: string,
        parentType: OrderParentType,
        parentId: string,
    ): Promise<EnrollmentDetail> {
        await this.findOrFail( userId, id );
        await this.dataSource.getRepository( EnrollmentOrder ).delete( { enrollmentId: id, parentType, parentId } );

        return this.detail( userId, id );
    }

    private async findOrFail( userId: string, id: string ): Promise<Enrollment> {
        // Another user's enrollment is "not found", so ids can't be probed.
        const enrollment = await this.dataSource.getRepository( Enrollment ).findOne( {
            where: { id, userId },
            relations: { learningPath: true, rules: true, orders: true },
        } );

        if ( !enrollment ) {
            throw new NotFoundException( 'Enrollment not found' );
        }

        return enrollment;
    }

    /**
     * The published path, or an empty one if the user can't see it any more (unpublished, made private, or
     * they left its organization since enrolling).
     */
    private async publishedTree( enrollment: Enrollment ): Promise<CatalogTree> {
        const tree = await this.catalogTree.load( enrollment.learningPathId, { publishedOnly: true } );

        return tree && await this.catalogAccess.canSeePath( enrollment.userId, tree )
            ? tree
            : { ...enrollment.learningPath, modules: [] };
    }

    private async build( enrollment: Enrollment ): Promise<EnrollmentDetail> {
        const tree = await this.publishedTree( enrollment );
        const selected = applyOrders( tree.id, selectContent( tree.modules, enrollment.rules ), enrollment.orders );
        const itemIds = itemIdsOf( allTopics( selected ) );
        const progressRows = await this.dataSource.getRepository( ItemProgress ).find( {
            select: { itemId: true, status: true },
            where: { userId: enrollment.userId, itemId: In( [ ...new Set( itemIds ) ] ) },
        } );
        const progress = new Map<string, ProgressStatus>( progressRows.map( ( row ) => [ row.itemId, row.status ] ) );
        const { modules, progress: pathProgress } = withProgress( selected, progress );
        const { id, status, position, createdAt, updatedAt, learningPath, rules, orders } = enrollment;

        return {
            id,
            status,
            position,
            enrolledAt: createdAt,
            updatedAt,
            learningPath,
            progress: pathProgress,
            rules: rules.map( ( { scope, scopeId, mode } ) => ( { scope, scopeId, mode } ) ),
            orders: orders.map( ( { parentType, parentId, orderedIds } ) => ( { parentType, parentId, orderedIds } ) ),
            modules,
        };
    }
}

async function insertRules( manager: EntityManager, enrollmentId: string, rules: EnrollmentRuleView[] ): Promise<void> {
    if ( rules.length > 0 ) {
        await manager.insert( EnrollmentRule, rules.map( ( rule ) => ( { ...rule, enrollmentId } ) ) );
    }
}

/** Each rule must point at published content of this path, once. */
function assertValidRules( tree: CatalogTree, rules: EnrollmentRuleView[] ): void {
    const known = {
        [RuleScope.Module]: new Set( tree.modules.map( ( module ) => module.id ) ),
        [RuleScope.Topic]: new Set( allTopics( tree.modules ).map( ( topic ) => topic.id ) ),
        [RuleScope.Item]: new Set( itemIdsOf( allTopics( tree.modules ) ) ),
    };
    const seen = new Set<string>();

    for ( const { scope, scopeId } of rules ) {
        const key = `${scope}:${scopeId}`;

        if ( seen.has( key ) ) {
            throw new BadRequestException( `More than one rule for ${scope} ${scopeId}` );
        }
        if ( !known[scope].has( scopeId ) ) {
            throw new BadRequestException( `No ${scope} ${scopeId} in this learning path` );
        }
        seen.add( key );
    }
}

function allTopics( modules: CatalogModuleNode[] ) {
    return modules.flatMap( ( module ) => module.topics );
}

/** Ids of the parent's children in the published tree, or undefined if the parent isn't in it. */
function childIdsOf( tree: CatalogTree, parentType: OrderParentType, parentId: string ): string[] | undefined {
    switch ( parentType ) {
        case OrderParentType.Path:
            return parentId === tree.id ? tree.modules.map( ( module ) => module.id ) : undefined;

        case OrderParentType.Module:
            return tree.modules.find( ( module ) => module.id === parentId )?.topics.map( ( topic ) => topic.id );

        case OrderParentType.Topic:
            return allTopics( tree.modules ).find( ( topic ) => topic.id === parentId )?.items.map( ( { id } ) => id );
    }
}
