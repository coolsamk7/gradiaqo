import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module.js';
import { EnrollmentsController } from './enrollments.controller.js';
import { EnrollmentsService } from './enrollments.service.js';
import { InsightsController } from './insights.controller.js';
import { InsightsService } from './insights.service.js';
import { ProgressController } from './progress.controller.js';
import { ProgressService } from './progress.service.js';
import { PublishedCatalogController } from './published-catalog.controller.js';
import { StatsController } from './stats.controller.js';
import { StatsService } from './stats.service.js';
import { StudySessionsController } from './study-sessions.controller.js';
import { StudySessionsService } from './study-sessions.service.js';

/**
 * The user's side of the catalog: browsing published paths, enrollments (with their own selection and order),
 * item progress, study sessions, stats and insights (analytics, interview goal, readiness). Everything under /me is scoped to the logged-in user.
 */
@Module( {
    imports: [ CatalogModule ],
    controllers: [
        PublishedCatalogController,
        EnrollmentsController,
        ProgressController,
        StudySessionsController,
        StatsController,
        InsightsController,
    ],
    providers: [ EnrollmentsService, ProgressService, StudySessionsService, StatsService, InsightsService ],
} )
export class StudyModule {}
