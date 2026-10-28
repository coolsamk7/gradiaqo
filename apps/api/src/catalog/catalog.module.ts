import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item, LearningModule, LearningPath, Topic, TopicItem } from '@studylog/database';

import { OrganizationsModule } from '../organizations/organizations.module.js';
import { ItemsController } from './controllers/items.controller.js';
import { LearningPathsController } from './controllers/learning-paths.controller.js';
import { ModulesController } from './controllers/modules.controller.js';
import { PathImportController } from './controllers/path-import.controller.js';
import { TopicsController } from './controllers/topics.controller.js';
import { CatalogScopeGuard } from './decorators/catalog-auth.decorator.js';
import { CatalogAccessService } from './services/catalog-access.service.js';
import { CatalogTreeService } from './services/catalog-tree.service.js';
import { ItemsService } from './services/items.service.js';
import { LearningPathsService } from './services/learning-paths.service.js';
import { ModulesService } from './services/modules.service.js';
import { PathImportService } from './services/path-import.service.js';
import { TopicsService } from './services/topics.service.js';

/**
 * The learning catalog (paths → modules → topics → items): the global one, managed by superadmins under
 * /admin/catalog, and each organization's own under /organizations/:organizationId/catalog. Superadmins can also
 * import official paths from path files (/admin/catalog/import).
 */
@Module( {
    imports: [
        OrganizationsModule,
        TypeOrmModule.forFeature( [ LearningPath, LearningModule, Topic, Item, TopicItem ] ),
    ],
    controllers: [ LearningPathsController, ModulesController, TopicsController, ItemsController, PathImportController ],
    providers: [
        LearningPathsService,
        ModulesService,
        TopicsService,
        ItemsService,
        PathImportService,
        CatalogTreeService,
        CatalogAccessService,
        CatalogScopeGuard,
    ],
    exports: [ CatalogTreeService, CatalogAccessService, ItemsService ],
} )
export class CatalogModule {}
