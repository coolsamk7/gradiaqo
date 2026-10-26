import { CatalogStatus, Item, LearningModule, LearningPath, PathVisibility, Topic, TopicItem } from '@studylog/database';
import type { EntityManager } from 'typeorm';
import { IsNull } from 'typeorm';

import type { CatalogItem, CatalogPath } from './catalog-file.js';
import { itemKey } from './catalog-file.js';

/** What an import changed, for the command to print. */
export interface ImportReport {
    path: { id: string; status: CatalogStatus; created: boolean; updated: boolean };
    modules: { created: number; updated: number };
    topics: { created: number; updated: number };
    items: { created: number; updated: number; linked: number; unlinked: number };
    /** Modules and topics that are in the database but not in the file. They're kept: delete them in Admin. */
    notInFile: string[];
    /** Items in the path that learners can't see, because they were a draft or archived before the import. */
    unpublishedItems: string[];
}

/** Columns compared to decide whether a row needs saving. */
type Comparable = Record<string, unknown>;

const same = ( a: unknown, b: unknown ) => JSON.stringify( a ) === JSON.stringify( b );

/** Copies the fields that differ onto `row`; true when any did. */
function assignChanged( row: Comparable, wanted: Comparable ): boolean {
    let changed = false;

    for ( const [ key, value ] of Object.entries( wanted ) ) {
        if ( !same( row[key], value ) ) {
            row[key] = value;
            changed = true;
        }
    }

    return changed;
}

/**
 * Makes the global catalog match a path file, inside `manager`'s transaction. Matching is by slug (path, modules,
 * topics) and by item identity (type and URL, or type and title), so running it again updates instead of
 * duplicating, and an item shared by several paths is one item.
 *
 * A new path starts as a draft: learners see it once an admin publishes it. New modules, topics and items are
 * published, so publishing the path shows all of it. Existing statuses are never changed. Items no longer listed
 * in a topic are unlinked from it (they stay in the catalog); modules and topics no longer in the file are kept and
 * reported, since deleting them would delete learners' choices about them.
 */
export async function importPath( manager: EntityManager, file: CatalogPath ): Promise<ImportReport> {
    const report: ImportReport = {
        path: { id: '', status: CatalogStatus.Draft, created: false, updated: false },
        modules: { created: 0, updated: 0 },
        topics: { created: 0, updated: 0 },
        items: { created: 0, updated: 0, linked: 0, unlinked: 0 },
        notInFile: [],
        unpublishedItems: [],
    };

    let path = await manager.findOneBy( LearningPath, { organizationId: IsNull(), slug: file.slug } );

    if ( path ) {
        const wanted = { title: file.title, description: file.description };

        report.path.updated = assignChanged( path as unknown as Comparable, wanted );
        if ( report.path.updated ) {
            await manager.save( path );
        }
    } else {
        const last = await manager.maximum( LearningPath, 'position', { organizationId: IsNull() } );

        path = await manager.save( manager.create( LearningPath, {
            organizationId: null,
            slug: file.slug,
            title: file.title,
            description: file.description,
            status: CatalogStatus.Draft,
            visibility: PathVisibility.Public,
            position: ( last ?? -1 ) + 1,
        } ) );
        report.path.created = true;
    }
    report.path.id = path.id;
    report.path.status = path.status;

    const items = new Map<string, Item>();
    const existingModules = await manager.findBy( LearningModule, { learningPathId: path.id } );

    for ( const [ position, spec ] of file.modules.entries() ) {
        const wanted = { title: spec.title, description: spec.description, position };
        let module = existingModules.find( ( row ) => row.slug === spec.slug );

        if ( module ) {
            if ( assignChanged( module as unknown as Comparable, wanted ) ) {
                await manager.save( module );
                report.modules.updated++;
            }
        } else {
            module = await manager.save( manager.create( LearningModule, {
                ...wanted,
                learningPathId: path.id,
                slug: spec.slug,
                status: CatalogStatus.Published,
            } ) );
            report.modules.created++;
        }

        const existingTopics = await manager.findBy( Topic, { moduleId: module.id } );

        for ( const [ topicPosition, topicSpec ] of spec.topics.entries() ) {
            const wantedTopic = { title: topicSpec.title, description: topicSpec.description, position: topicPosition };
            let topic = existingTopics.find( ( row ) => row.slug === topicSpec.slug );

            if ( topic ) {
                if ( assignChanged( topic as unknown as Comparable, wantedTopic ) ) {
                    await manager.save( topic );
                    report.topics.updated++;
                }
            } else {
                topic = await manager.save( manager.create( Topic, {
                    ...wantedTopic,
                    moduleId: module.id,
                    slug: topicSpec.slug,
                    status: CatalogStatus.Published,
                } ) );
                report.topics.created++;
            }

            const itemIds: string[] = [];

            for ( const itemSpec of topicSpec.items ) {
                itemIds.push( ( await upsertItem( manager, itemSpec, items, report ) ).id );
            }
            await linkItems( manager, topic.id, itemIds, topicSpec.items, report );
        }

        for ( const topic of existingTopics ) {
            if ( !spec.topics.some( ( topicSpec ) => topicSpec.slug === topic.slug ) ) {
                report.notInFile.push( `topic "${topic.title}" in "${module.title}"` );
            }
        }
    }

    for ( const module of existingModules ) {
        if ( !file.modules.some( ( spec ) => spec.slug === module.slug ) ) {
            report.notInFile.push( `module "${module.title}"` );
        }
    }
    for ( const item of items.values() ) {
        if ( item.status !== CatalogStatus.Published ) {
            report.unpublishedItems.push( `"${item.title}" (${item.status})` );
        }
    }

    return report;
}

/** The global item for `spec`, created or brought up to date. Each item is handled once per import. */
async function upsertItem(
    manager: EntityManager,
    spec: CatalogItem,
    seen: Map<string, Item>,
    report: ImportReport,
): Promise<Item> {
    const key = itemKey( spec );
    const done = seen.get( key );

    if ( done ) {
        return done;
    }

    const url = spec.details.url;
    const found = typeof url === 'string'
        ? await manager.createQueryBuilder( Item, 'item' )
                .where( 'item.organization_id IS NULL' )
                .andWhere( 'item.type = :type', { type: spec.type } )
                .andWhere( 'item.details ->> \'url\' = :url', { url } )
                .getOne()
        : await manager.findOneBy( Item, { organizationId: IsNull(), type: spec.type, title: spec.title } );
    const wanted = {
        title: spec.title,
        description: spec.description,
        difficulty: spec.difficulty,
        estimatedMinutes: spec.estimatedMinutes,
        tags: spec.tags,
        details: spec.details,
    };
    let item: Item;

    if ( found ) {
        item = found;
        if ( assignChanged( item as unknown as Comparable, wanted ) ) {
            await manager.save( item );
            report.items.updated++;
        }
    } else {
        item = await manager.save( manager.create( Item, {
            ...wanted,
            organizationId: null,
            type: spec.type,
            status: CatalogStatus.Published,
        } ) );
        report.items.created++;
    }
    seen.set( key, item );

    return item;
}

/** Makes the topic's items exactly `itemIds`, in that order. */
async function linkItems(
    manager: EntityManager,
    topicId: string,
    itemIds: string[],
    specs: CatalogItem[],
    report: ImportReport,
): Promise<void> {
    const links = await manager.findBy( TopicItem, { topicId } );

    for ( const link of links ) {
        if ( !itemIds.includes( link.itemId ) ) {
            await manager.delete( TopicItem, { topicId, itemId: link.itemId } );
            report.items.unlinked++;
        }
    }
    for ( const [ position, itemId ] of itemIds.entries() ) {
        const wanted = { position, isOptional: specs[position].isOptional };
        const link = links.find( ( row ) => row.itemId === itemId );

        if ( !link ) {
            await manager.insert( TopicItem, { topicId, itemId, ...wanted } );
            report.items.linked++;
        } else if ( link.position !== wanted.position || link.isOptional !== wanted.isOptional ) {
            await manager.update( TopicItem, { topicId, itemId }, wanted );
        }
    }
}
