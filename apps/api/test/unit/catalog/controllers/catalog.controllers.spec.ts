import type { AccessTokenPayload } from '@studylog/casl';

import { ItemsController } from '../../../../src/catalog/controllers/items.controller.js';
import { LearningPathsController } from '../../../../src/catalog/controllers/learning-paths.controller.js';
import { ModulesController } from '../../../../src/catalog/controllers/modules.controller.js';
import { PathImportController } from '../../../../src/catalog/controllers/path-import.controller.js';
import { TopicsController } from '../../../../src/catalog/controllers/topics.controller.js';
import { CatalogOwner } from '../../../../src/catalog/decorators/catalog-auth.decorator.js';
import type { ItemsService } from '../../../../src/catalog/services/items.service.js';
import type { LearningPathsService } from '../../../../src/catalog/services/learning-paths.service.js';
import type { ModulesService } from '../../../../src/catalog/services/modules.service.js';
import type { PathImportService } from '../../../../src/catalog/services/path-import.service.js';
import type { TopicsService } from '../../../../src/catalog/services/topics.service.js';
import { httpContext, paramDecoratorFactory } from '../../param-decorator.js';

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
const pathImport = mocks( 'import' );

const controllers = {
    paths: new LearningPathsController(
        paths as unknown as LearningPathsService,
        modules as unknown as ModulesService,
    ),
    modules: new ModulesController( modules as unknown as ModulesService, topics as unknown as TopicsService ),
    topics: new TopicsController( topics as unknown as TopicsService ),
    items: new ItemsController( items as unknown as ItemsService ),
    import: new PathImportController( pathImport as unknown as PathImportService ),
};

type Case = [ string, () => Promise<unknown>, ReturnType<typeof vi.fn>, unknown[] ];

describe( 'catalog controllers', () => {
    it.each<Case>( [
        [ 'paths.list', () => controllers.paths.list( OWNER ), paths.list, [ OWNER ] ],
        [ 'paths.create', () => controllers.paths.create( OWNER, user, dto ), paths.create, [ OWNER, dto, 'user-1' ] ],
        [ 'paths.reorder', () => controllers.paths.reorder( OWNER, ids ), paths.reorder, [ OWNER, ids.ids ] ],
        [ 'paths.findTree', () => controllers.paths.findTree( OWNER, 'p' ), paths.findTree, [ OWNER, 'p' ] ],
        [ 'paths.update', () => controllers.paths.update( OWNER, user, 'p', dto ), paths.update, [ OWNER, 'p', dto, 'user-1' ] ],
        [ 'paths.remove', () => controllers.paths.remove( OWNER, user, 'p' ), paths.remove, [ OWNER, 'p', 'user-1' ] ],
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
        [ 'items.update', () => controllers.items.update( OWNER, user, 'i', dto ), items.update, [ OWNER, 'i', dto, 'user-1' ] ],
        [ 'items.remove', () => controllers.items.remove( OWNER, user, 'i' ), items.remove, [ OWNER, 'i', 'user-1' ] ],
        [ 'import', () => controllers.import.import( OWNER, user, { content: 'slug: x' } ), pathImport.import, [ OWNER, { content: 'slug: x' }, 'user-1' ] ],
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
