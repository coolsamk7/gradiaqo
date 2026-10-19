import type { LearningPathTreeJson } from '@studylog/schemas';
import { ItemType } from '@studylog/schemas/enums';

import type { IconName } from '../../components/Icon.tsx';
import { DIFFICULTY_LABELS, TYPE_LABELS } from '../path/item-details.ts';

export type ModuleNode = LearningPathTreeJson['modules'][number];
export type TopicNode = ModuleNode['topics'][number];
export type ItemNode = TopicNode['items'][number];

/** What the editor shows: the path itself, a module or a topic. */
export type Selection = { kind: 'path' } | { kind: 'module'; id: string } | { kind: 'topic'; id: string };

export type Selected =
    | { kind: 'path' }
    | { kind: 'module'; module: ModuleNode }
    | { kind: 'topic'; topic: TopicNode; module: ModuleNode };

/**
 * The chosen part of the path. Without a choice, or when the chosen part is gone (deleted), the first topic, else the
 * first module, else the path.
 */
export function resolveSelection( path: LearningPathTreeJson, selection: Selection | undefined ): Selected {
    for ( const module of path.modules ) {
        if ( selection?.kind === 'module' && selection.id === module.id ) {
            return { kind: 'module', module };
        }

        const topic = module.topics.find( ( candidate ) => selection?.kind === 'topic' && selection.id === candidate.id );

        if ( topic ) {
            return { kind: 'topic', topic, module };
        }
    }
    if ( selection?.kind === 'path' ) {
        return selection;
    }

    const module = path.modules.find( ( candidate ) => candidate.topics.length > 0 ) ?? path.modules.at( 0 );
    const topic = module?.topics.at( 0 );

    if ( module && topic ) {
        return { kind: 'topic', topic, module };
    }

    return module ? { kind: 'module', module } : { kind: 'path' };
}

/** The ids in their new order after moving `id` one place up (-1) or down (+1). */
export function moved( ids: string[], id: string, by: -1 | 1 ): string[] {
    const from = ids.indexOf( id );
    const order = [ ...ids ];

    [ order[from], order[from + by] ] = [ order[from + by], order[from] ];

    return order;
}

export const TYPE_ICONS: Record<ItemType, IconName> = {
    [ItemType.Problem]: 'code',
    [ItemType.Article]: 'file-text',
    [ItemType.Video]: 'video',
    [ItemType.Book]: 'book-open',
    [ItemType.Course]: 'layers',
    [ItemType.Note]: 'file-text',
    [ItemType.Exercise]: 'edit',
};

/** "Problem · Medium · from the catalog", "Note · your item". */
export function itemMeta( item: Pick<ItemNode, 'type' | 'difficulty' | 'organizationId'>, where?: string ): string {
    return [
        TYPE_LABELS[item.type],
        item.difficulty && DIFFICULTY_LABELS[item.difficulty],
        where ?? ( item.organizationId === null ? 'from the catalog' : 'your item' ),
    ].filter( Boolean ).join( ' · ' );
}
