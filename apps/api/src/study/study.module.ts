import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module.js';
import { EnrollmentsController } from './controllers/enrollments.controller.js';
import { InsightsController } from './controllers/insights.controller.js';
import { ProgressController } from './controllers/progress.controller.js';
import { PublishedCatalogController } from './controllers/published-catalog.controller.js';
import { StatsController } from './controllers/stats.controller.js';
import { StudySessionsController } from './controllers/study-sessions.controller.js';
import { EnrollmentsService } from './services/enrollments.service.js';
import { InsightsService } from './services/insights.service.js';
import { ProgressService } from './services/progress.service.js';
import { StatsService } from './services/stats.service.js';
import { StudySessionsService } from './services/study-sessions.service.js';

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
