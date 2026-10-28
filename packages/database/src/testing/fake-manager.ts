import { randomUUID } from 'node:crypto';

import type { EntityManager } from 'typeorm';
import { FindOperator } from 'typeorm';

import { Item } from '../entities/item.entity.js';
import { LearningModule } from '../entities/learning-module.entity.js';
import { LearningPath } from '../entities/learning-path.entity.js';
import { Topic } from '../entities/topic.entity.js';
import { TopicItem } from '../entities/topic-item.entity.js';

type Row = Record<string, unknown>;
type Entity = new () => object;

/**
 * An EntityManager over in-memory tables, enough for catalog:import: tests set up rows, run the import, and look at
 * the tables afterwards. Only the calls the import makes are supported.
 */
export function fakeManager() {
    const entities: Entity[] = [ LearningPath, LearningModule, Topic, Item, TopicItem ];
    const tables = new Map<Entity, Row[]>( entities.map( ( entity ) => [ entity, [] ] ) );
    const table = ( entity: Entity ) => tables.get( entity )!;
    const matches = ( row: Row, where: Row ) => Object.entries( where ).every( ( [ key, value ] ) =>
        ( value instanceof FindOperator ? row[key] === null : row[key] === value ) );
    // What the import asked for beyond reads that change nothing, so tests can check it doesn't do needless writes.
    const calls = { saves: 0, updates: 0, itemLookups: 0 };
    const insert = ( entity: Entity, data: Row ) => {
        const row = Object.assign( new entity(), data );

        table( entity ).push( row );

        return row;
    };

    const manager = {
        findOneBy: ( entity: Entity, where: Row ) =>
            Promise.resolve( table( entity ).find( ( row ) => matches( row, where ) ) ?? null ),
        findBy: ( entity: Entity, where: Row ) =>
            Promise.resolve( table( entity ).filter( ( row ) => matches( row, where ) ) ),
        maximum: ( entity: Entity, column: string, where: Row ) => {
            const values = table( entity )
                .filter( ( row ) => matches( row, where ) )
                .map( ( row ) => row[column] as number );

            return Promise.resolve( values.length > 0 ? Math.max( ...values ) : null );
        },
        create: ( entity: Entity, data: Row ) => Object.assign( new entity(), data ),
        save: ( row: Row ) => {
            calls.saves++;
            if ( !row.id ) {
                row.id = randomUUID();
                table( row.constructor as Entity ).push( row );
            }

            return Promise.resolve( row );
        },
        insert: ( entity: Entity, data: Row ) => Promise.resolve( insert( entity, data ) ),
        update: ( entity: Entity, where: Row, data: Row ) => {
            calls.updates++;
            table( entity ).filter( ( row ) => matches( row, where ) ).forEach( ( row ) => Object.assign( row, data ) );

            return Promise.resolve();
        },
        delete: ( entity: Entity, where: Row ) => {
            tables.set( entity, table( entity ).filter( ( row ) => !matches( row, where ) ) );

            return Promise.resolve();
        },
        // Only the item lookup by type and URL.
        createQueryBuilder: () => {
            const params: Row = {};
            const builder = {
                where: () => builder,
                andWhere: ( _: string, values: Row ) => Object.assign( params, values ) && builder,
                getOne: () => {
                    calls.itemLookups++;

                    return Promise.resolve( table( Item ).find( ( row ) => row.organizationId === null
                        && row.type === params.type && ( row.details as Row ).url === params.url ) ?? null );
                },
            };

            return builder;
        },
    };

    return {
        manager: manager as unknown as EntityManager,
        /** The rows of a table. */
        rows: ( entity: Entity ) => table( entity ),
        calls,
        /** Adds a row, as if it were already in the database. */
        add: ( entity: Entity, data: Row ) => insert( entity, { id: randomUUID(), ...data } ),
    };
}
