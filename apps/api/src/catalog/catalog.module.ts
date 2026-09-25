import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item, LearningModule, LearningPath, Topic, TopicItem } from '@studylog/database';

import { OrganizationsModule } from '../organizations/organizations.module.js';
import { CatalogAccessService } from './catalog-access.service.js';
import { CatalogScopeGuard } from './catalog-auth.decorator.js';
import { CatalogTreeService } from './catalog-tree.service.js';
import { ItemsController } from './items.controller.js';
import { ItemsService } from './items.service.js';
import { LearningPathsController } from './learning-paths.controller.js';
import { LearningPathsService } from './learning-paths.service.js';
import { ModulesController } from './modules.controller.js';
import { ModulesService } from './modules.service.js';
import { TopicsController } from './topics.controller.js';
import { TopicsService } from './topics.service.js';

/**
 * The learning catalog (paths → modules → topics → items): the global one, managed by superadmins under
 * /admin/catalog, and each organization's own under /organizations/:organizationId/catalog.
 */
@Module( {
    imports: [
        OrganizationsModule,
        TypeOrmModule.forFeature( [ LearningPath, LearningModule, Topic, Item, TopicItem ] ),
    ],
    controllers: [ LearningPathsController, ModulesController, TopicsController, ItemsController ],
    providers: [
        LearningPathsService,
        ModulesService,
        TopicsService,
        ItemsService,
        CatalogTreeService,
        CatalogAccessService,
        CatalogScopeGuard,
    ],
    exports: [ CatalogTreeService, CatalogAccessService, ItemsService ],
} )
export class CatalogModule {}
