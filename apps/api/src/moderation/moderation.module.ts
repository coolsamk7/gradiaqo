import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module.js';
import { AdminHiddenPathsController, AdminReportsController, PathReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

/** Reports on user-shared public paths, reviewed by superadmins. */
@Module( {
    imports: [ CatalogModule ],
    controllers: [ PathReportsController, AdminReportsController, AdminHiddenPathsController ],
    providers: [ ReportsService ],
} )
export class ModerationModule {}
