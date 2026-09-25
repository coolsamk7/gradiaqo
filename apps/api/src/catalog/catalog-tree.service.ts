import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Item } from '@studylog/database';
import { CatalogStatus, LearningModule, LearningPath, Topic, TopicItem } from '@studylog/database';
import type { TopicItem as TopicItemView } from '@studylog/schemas';
import type { FindOptionsWhere } from 'typeorm';
import { DataSource, In } from 'typeorm';

export type CatalogItemNode = TopicItemView;
// The entities' own relation fields (e.g. `LearningModule.topics`) are replaced by the ordered, loaded children.
export type CatalogTopicNode = Omit<Topic, 'topicItems' | 'module'> & { items: CatalogItemNode[] };
export type CatalogModuleNode = Omit<LearningModule, 'topics' | 'learningPath'> & { topics: CatalogTopicNode[] };
export type CatalogTree = Omit<LearningPath, 'modules'> & { modules: CatalogModuleNode[] };

/** Loads a learning path with its modules, topics and items, each level in the admin's order. */
@Injectable()
export class CatalogTreeService {
    constructor( @InjectDataSource() private readonly dataSource: DataSource ) {}

    /**
     * `publishedOnly`: what users see. The path and every module, topic and item in it must be published;
     * anything under a draft or archived parent is left out with it. Returns null if the path isn't found.
     */
    async load( pathId: string, { publishedOnly }: { publishedOnly: boolean } ): Promise<CatalogTree | null> {
        const published = publishedOnly ? { status: CatalogStatus.Published } : {};
        const path = await this.dataSource.getRepository( LearningPath ).findOneBy( { id: pathId, ...published } );

        if ( !path ) {
            return null;
        }

        const modules = await this.dataSource.getRepository( LearningModule ).find( {
            where: { learningPathId: pathId, ...published },
            order: { position: 'ASC', createdAt: 'ASC' },
        } );
        const topics = await this.dataSource.getRepository( Topic ).find( {
            where: { moduleId: In( modules.map( ( module ) => module.id ) ), ...published },
            order: { position: 'ASC', createdAt: 'ASC' },
        } );
        const links = await this.dataSource.getRepository( TopicItem ).find( {
            where: {
                topicId: In( topics.map( ( topic ) => topic.id ) ),
                ...( publishedOnly && { item: { status: CatalogStatus.Published } as FindOptionsWhere<Item> } ),
            },
            relations: { item: true },
            order: { position: 'ASC', createdAt: 'ASC' },
        } );

        return {
            ...path,
            modules: modules.map( ( module ) => ( {
                ...module,
                topics: topics
                    .filter( ( topic ) => topic.moduleId === module.id )
                    .map( ( topic ) => ( {
                        ...topic,
                        items: links.filter( ( link ) => link.topicId === topic.id ).map( toTopicItemView ),
                    } ) ),
            } ) ),
        };
    }
}

export function toTopicItemView( { item, position, isOptional }: TopicItem ): TopicItemView {
    return { ...item, position, isOptional };
}
