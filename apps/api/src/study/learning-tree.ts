import type { EnrollmentOrder, EnrollmentRule, MyModule, MyTopic, ProgressCount } from '@studylog/schemas';
import { OrderParentType, ProgressStatus, RuleMode, RuleScope } from '@studylog/schemas';

import type { CatalogModuleNode, CatalogTopicNode } from '../catalog/services/catalog-tree.service.js';

/*
 * Pure functions that turn a published path into one user's view of it: the parts their rules select, in
 * their order, with their progress. Nothing here touches the database.
 */

type Rule = Pick<EnrollmentRule, 'scope' | 'scopeId' | 'mode'>;
type Order = Pick<EnrollmentOrder, 'parentType' | 'parentId' | 'orderedIds'>;

/**
 * Keeps what the rules select. Without include rules everything is selected; with them, only what they cover.
 * For each item the most specific rule wins (item → topic → module), so "include Arrays, exclude Hashing"
 * works. A topic or module shows when anything in it is selected, or when it's selected and still empty.
 */
export function selectContent( modules: CatalogModuleNode[], rules: Rule[] ): CatalogModuleNode[] {
    const modeOf = new Map( rules.map( ( rule ) => [ `${rule.scope}:${rule.scopeId}`, rule.mode ] ) );
    const byDefault = !rules.some( ( rule ) => rule.mode === RuleMode.Include );
    const decide = ( ...modes: ( RuleMode | undefined )[] ) => {
        const mode = modes.find( ( candidate ) => candidate !== undefined );

        return mode === undefined ? byDefault : mode === RuleMode.Include;
    };

    return modules.flatMap( ( module ) => {
        const moduleMode = modeOf.get( `${RuleScope.Module}:${module.id}` );
        const topics = module.topics.flatMap( ( topic ) => {
            const topicMode = modeOf.get( `${RuleScope.Topic}:${topic.id}` );
            const items = topic.items.filter( ( item ) =>
                decide( modeOf.get( `${RuleScope.Item}:${item.id}` ), topicMode, moduleMode ) );
            const keep = items.length > 0 || ( topic.items.length === 0 && decide( topicMode, moduleMode ) );

            return keep ? [ { ...topic, items } ] : [];
        } );
        const keep = topics.length > 0 || ( module.topics.length === 0 && decide( moduleMode ) );

        return keep ? [ { ...module, topics } ] : [];
    } );
}

/**
 * Puts children in the user's order where they set one. Children they didn't list (e.g. added later) follow
 * in the admin's order; listed ids that no longer exist are ignored.
 */
export function orderChildren<T extends { id: string }>( children: T[], orderedIds: string[] | undefined ): T[] {
    if ( !orderedIds?.length ) {
        return children;
    }

    const byId = new Map( children.map( ( child ) => [ child.id, child ] ) );
    const listed = orderedIds.flatMap( ( id ) => byId.get( id ) ?? [] );
    const rest = children.filter( ( child ) => !orderedIds.includes( child.id ) );

    return [ ...listed, ...rest ];
}

export function applyOrders( pathId: string, modules: CatalogModuleNode[], orders: Order[] ): CatalogModuleNode[] {
    const orderOf = ( parentType: OrderParentType, parentId: string ) =>
        orders.find( ( order ) => order.parentType === parentType && order.parentId === parentId )?.orderedIds;

    return orderChildren( modules, orderOf( OrderParentType.Path, pathId ) ).map( ( module ) => ( {
        ...module,
        topics: orderChildren( module.topics, orderOf( OrderParentType.Module, module.id ) ).map( ( topic ) => ( {
            ...topic,
            items: orderChildren( topic.items, orderOf( OrderParentType.Topic, topic.id ) ),
        } ) ),
    } ) );
}

const COMPLETED = new Set( [ ProgressStatus.Done, ProgressStatus.Revise ] );

/** Every item id under the given topics (repeated if an item is in several). */
export function itemIdsOf( topics: CatalogTopicNode[] ): string[] {
    return topics.flatMap( ( topic ) => topic.items.map( ( item ) => item.id ) );
}

/**
 * Required (non-optional) items under the given topics and how many are done or marked for revision. Each
 * item counts once, even when it appears in several topics.
 */
function countProgress( topics: CatalogTopicNode[], progress: Map<string, ProgressStatus> ): ProgressCount {
    const required = new Set(
        topics.flatMap( ( topic ) => topic.items.filter( ( item ) => !item.isOptional ).map( ( item ) => item.id ) ),
    );
    const completed = [ ...required ].filter( ( id ) => COMPLETED.has( statusOf( progress, id ) ) );

    return { completed: completed.length, total: required.size };
}

/** Adds the user's status to every item and progress counts to every topic, module and the whole path. */
export function withProgress(
    modules: CatalogModuleNode[],
    progress: Map<string, ProgressStatus>,
): { modules: MyModule[]; progress: ProgressCount } {
    const toTopic = ( topic: CatalogTopicNode ): MyTopic => ( {
        ...topic,
        progress: countProgress( [ topic ], progress ),
        items: topic.items.map( ( item ) => ( { ...item, progress: statusOf( progress, item.id ) } ) ),
    } );

    return {
        modules: modules.map( ( module ) => ( {
            ...module,
            progress: countProgress( module.topics, progress ),
            topics: module.topics.map( toTopic ),
        } ) ),
        progress: countProgress( modules.flatMap( ( module ) => module.topics ), progress ),
    };
}

function statusOf( progress: Map<string, ProgressStatus>, itemId: string ): ProgressStatus {
    return progress.get( itemId ) ?? ProgressStatus.NotStarted;
}
