import type { AccessTokenPayload } from '@studylog/casl';

import { CatalogOwner } from '../../../src/catalog/catalog-auth.decorator.js';
import { ItemsController } from '../../../src/catalog/items.controller.js';
import type { ItemsService } from '../../../src/catalog/items.service.js';
import { LearningPathsController } from '../../../src/catalog/learning-paths.controller.js';
import type { LearningPathsService } from '../../../src/catalog/learning-paths.service.js';
import { ModulesController } from '../../../src/catalog/modules.controller.js';
import type { ModulesService } from '../../../src/catalog/modules.service.js';
import { TopicsController } from '../../../src/catalog/topics.controller.js';
import type { TopicsService } from '../../../src/catalog/topics.service.js';
import { httpContext, paramDecoratorFactory } from '../param-decorator.js';

/*
 * The catalog controllers only hand requests to the services; what matters is that every call carries the catalog
 * (owner), the ids and the user from the request.
 */

const OWNER = 'org-1';
const user = { sub: 'user-1' } as AccessTokenPayload;
const dto = { title: 'X' };
const ids = { ids: [ 'b', 'a' ] };

const mocks = <T extends string>( ...methods: T[] ) =>
    Object.fromEntries( methods.map( ( method ) => [ method, vi.fn().mockResolvedValue( `${method} result` ) ] ) ) as Record<T, ReturnType<typeof vi.fn>>;

const paths = mocks( 'list', 'create', 'reorder', 'findTree', 'update', 'remove' );
const modules = mocks( 'create', 'reorder', 'update', 'remove' );
const topics = mocks( 'create', 'reorder', 'update', 'remove', 'listItems', 'reorderItems', 'linkItem', 'unlinkItem' );
const items = mocks( 'list', 'create', 'findOrFail', 'update', 'remove' );

const controllers = {
    paths: new LearningPathsController(
        paths as unknown as LearningPathsService,
        modules as unknown as ModulesService,
    ),
    modules: new ModulesController( modules as unknown as ModulesService, topics as unknown as TopicsService ),
    topics: new TopicsController( topics as unknown as TopicsService ),
    items: new ItemsController( items as unknown as ItemsService ),
};

type Case = [ string, () => Promise<unknown>, ReturnType<typeof vi.fn>, unknown[] ];

describe( 'catalog controllers', () => {
    it.each<Case>( [
        [ 'paths.list', () => controllers.paths.list( OWNER ), paths.list, [ OWNER ] ],
        [ 'paths.create', () => controllers.paths.create( OWNER, user, dto ), paths.create, [ OWNER, dto, 'user-1' ] ],
        [ 'paths.reorder', () => controllers.paths.reorder( OWNER, ids ), paths.reorder, [ OWNER, ids.ids ] ],
        [ 'paths.findTree', () => controllers.paths.findTree( OWNER, 'p' ), paths.findTree, [ OWNER, 'p' ] ],
        [ 'paths.update', () => controllers.paths.update( OWNER, 'p', dto ), paths.update, [ OWNER, 'p', dto ] ],
        [ 'paths.remove', () => controllers.paths.remove( OWNER, 'p' ), paths.remove, [ OWNER, 'p' ] ],
        [ 'paths.createModule', () => controllers.paths.createModule( OWNER, 'p', dto ), modules.create, [ OWNER, 'p', dto ] ],
        [ 'paths.reorderModules', () => controllers.paths.reorderModules( OWNER, 'p', ids ), modules.reorder, [ OWNER, 'p', ids.ids ] ],
        [ 'modules.update', () => controllers.modules.update( OWNER, 'm', dto ), modules.update, [ OWNER, 'm', dto ] ],
        [ 'modules.remove', () => controllers.modules.remove( OWNER, 'm' ), modules.remove, [ OWNER, 'm' ] ],
        [ 'modules.createTopic', () => controllers.modules.createTopic( OWNER, 'm', dto ), topics.create, [ OWNER, 'm', dto ] ],
        [ 'modules.reorderTopics', () => controllers.modules.reorderTopics( OWNER, 'm', ids ), topics.reorder, [ OWNER, 'm', ids.ids ] ],
        [ 'topics.update', () => controllers.topics.update( OWNER, 't', dto ), topics.update, [ OWNER, 't', dto ] ],
        [ 'topics.remove', () => controllers.topics.remove( OWNER, 't' ), topics.remove, [ OWNER, 't' ] ],
        [ 'topics.listItems', () => controllers.topics.listItems( OWNER, 't' ), topics.listItems, [ OWNER, 't' ] ],
        [ 'topics.reorderItems', () => controllers.topics.reorderItems( OWNER, 't', ids ), topics.reorderItems, [ OWNER, 't', ids.ids ] ],
        [ 'topics.linkItem', () => controllers.topics.linkItem( OWNER, 't', 'i', { isOptional: true } ), topics.linkItem, [ OWNER, 't', 'i', { isOptional: true } ] ],
        [ 'topics.unlinkItem', () => controllers.topics.unlinkItem( OWNER, 't', 'i' ), topics.unlinkItem, [ OWNER, 't', 'i' ] ],
        [ 'items.list', () => controllers.items.list( OWNER, { search: 'two' } ), items.list, [ OWNER, { search: 'two' } ] ],
        [ 'items.create', () => controllers.items.create( OWNER, user, dto as never ), items.create, [ OWNER, dto, 'user-1' ] ],
        [ 'items.findOne', () => controllers.items.findOne( OWNER, 'i' ), items.findOrFail, [ OWNER, 'i' ] ],
        [ 'items.update', () => controllers.items.update( OWNER, 'i', dto ), items.update, [ OWNER, 'i', dto ] ],
        [ 'items.remove', () => controllers.items.remove( OWNER, 'i' ), items.remove, [ OWNER, 'i' ] ],
    ] )( '%s passes the catalog, ids and user to the service', async ( _, call, method, expected ) => {
        await expect( call() ).resolves.toMatch( /result$/ );
        expect( method ).toHaveBeenLastCalledWith( ...expected );
    } );

    it( '@CatalogOwner() is the organization from the organization guard, or null for the global catalog', () => {
        const owner = paramDecoratorFactory( CatalogOwner );

        expect( owner( undefined, httpContext( { organization: { organizationId: OWNER } } ) ) ).toBe( OWNER );
        expect( owner( undefined, httpContext( {} ) ) ).toBeNull();
    } );
} );
