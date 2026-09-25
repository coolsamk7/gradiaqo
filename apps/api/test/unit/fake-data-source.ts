import { randomUUID } from 'node:crypto';

import type { Mock } from 'vitest';

/*
 * Stand-ins for TypeORM's DataSource, EntityManager and repositories, for unit tests of services. Every method
 * is a `vi.fn()` with a harmless default (nothing found, one row affected), so a test only sets up the calls
 * its rule depends on and asserts on the calls it expects:
 *
 *   const db = fakeDataSource();
 *   db.repo( Membership ).existsBy.mockResolvedValue( true );
 *   ...
 *   expect( db.repo( Membership ).insert ).not.toHaveBeenCalled();
 *
 * `db.transaction` runs its callback right away with `db.manager`, whose methods route to the same repositories
 * (`manager.update( Membership, ... )` is `db.repo( Membership ).update( ... )`).
 */

const REPOSITORY_METHODS = [
    'count',
    'countBy',
    'create',
    'createQueryBuilder',
    'delete',
    'exists',
    'existsBy',
    'find',
    'findAndCount',
    'findBy',
    'findOne',
    'findOneBy',
    'findOneByOrFail',
    'findOneOrFail',
    'insert',
    'maximum',
    'query',
    'remove',
    'save',
    'update',
    'upsert',
] as const;

type RepositoryMethod = ( typeof REPOSITORY_METHODS )[number];
export type FakeRepository = Record<RepositoryMethod, Mock>;

/** The entity a `manager.create( Entity, data )` object belongs to, so `manager.save( object )` finds its repository. */
const ENTITY = Symbol( 'entity' );

type Row = Record<string | symbol, unknown>;

export function fakeRepository(): FakeRepository {
    const repository = Object.fromEntries(
        REPOSITORY_METHODS.map( ( method ) => [ method, vi.fn() ] ),
    ) as FakeRepository;

    repository.create.mockImplementation( ( data: Row ) => ( { ...data } ) );
    repository.save.mockImplementation( ( row: Row | Row[] ) =>
        Promise.resolve( Array.isArray( row ) ? row : withGeneratedColumns( row ) ) );
    repository.find.mockResolvedValue( [] );
    repository.findBy.mockResolvedValue( [] );
    repository.findAndCount.mockResolvedValue( [ [], 0 ] );
    repository.findOne.mockResolvedValue( null );
    repository.findOneBy.mockResolvedValue( null );
    repository.exists.mockResolvedValue( false );
    repository.existsBy.mockResolvedValue( false );
    repository.count.mockResolvedValue( 0 );
    repository.countBy.mockResolvedValue( 0 );
    repository.maximum.mockResolvedValue( null );
    repository.insert.mockResolvedValue( {} );
    repository.upsert.mockResolvedValue( {} );
    repository.update.mockResolvedValue( { affected: 1 } );
    repository.delete.mockResolvedValue( { affected: 1 } );
    repository.remove.mockImplementation( ( row: unknown ) => Promise.resolve( row ) );
    repository.query.mockResolvedValue( [] );
    repository.findOneOrFail.mockRejectedValue( new Error( 'findOneOrFail not set up in this test' ) );
    repository.findOneByOrFail.mockRejectedValue( new Error( 'findOneByOrFail not set up in this test' ) );

    return repository;
}

export interface FakeDataSource {
    /** The fake repository for an entity class (created on first use, then always the same). */
    repo: ( entity: unknown ) => FakeRepository;
    getRepository: Mock;
    transaction: Mock;
    query: Mock;
    manager: Record<string, Mock>;
}

export function fakeDataSource(): FakeDataSource {
    const repositories = new Map<unknown, FakeRepository>();
    const repo = ( entity: unknown ): FakeRepository => {
        let repository = repositories.get( entity );

        if ( !repository ) {
            repository = fakeRepository();
            repositories.set( entity, repository );
        }

        return repository;
    };
    const query = vi.fn().mockResolvedValue( [] );
    // manager.<method>( Entity, ...args ) → repo( Entity ).<method>( ...args ), except for the methods below.
    const manager = new Proxy( {} as Record<string, Mock>, {
        get: ( cache, method: string ) => {
            cache[method] ??= vi.fn( ( entity: unknown, ...args: unknown[] ): unknown => {
                switch ( method ) {
                    case 'getRepository':
                        return repo( entity );
                    case 'query':
                        return query( entity, ...args ) as unknown;
                    case 'create':
                        return { ...( args[0] as Row ), [ENTITY]: entity };
                    case 'save': {
                        const row = entity as Row;

                        return repo( row[ENTITY] ).save( row ) as unknown;
                    }
                    case 'remove':
                        return Promise.resolve( entity );
                    default:
                        return ( repo( entity ) as Record<string, Mock> )[method]( ...args ) as unknown;
                }
            } );

            return cache[method];
        },
    } );

    return {
        repo,
        getRepository: vi.fn( repo ),
        transaction: vi.fn( ( work: ( m: typeof manager ) => unknown ) => Promise.resolve( work( manager ) ) ),
        query,
        manager,
    };
}

/** A chainable stand-in for `repository.createQueryBuilder()`; `result` is what getMany/getManyAndCount return. */
export function fakeQueryBuilder( result: unknown[] = [], total = result.length ) {
    const builder: Record<string, Mock> = {};

    const chainable = [ 'where', 'andWhere', 'orWhere', 'orderBy', 'addOrderBy', 'leftJoinAndSelect', 'take', 'skip', 'addSelect' ];

    for ( const method of chainable ) {
        builder[method] = vi.fn( () => builder );
    }
    builder.getMany = vi.fn().mockResolvedValue( result );
    builder.getOne = vi.fn().mockResolvedValue( result[0] ?? null );
    builder.getManyAndCount = vi.fn().mockResolvedValue( [ result, total ] );

    return builder;
}

function withGeneratedColumns( row: Row ): Row {
    const now = new Date();

    return { id: randomUUID(), createdAt: now, updatedAt: now, ...row };
}
