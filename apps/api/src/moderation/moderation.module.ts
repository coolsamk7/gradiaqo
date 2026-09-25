import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module.js';
import { AdminReportsController, PathReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

/** Reports on user-shared public paths, reviewed by superadmins. */
@Module( {
    imports: [ CatalogModule ],
    controllers: [ PathReportsController, AdminReportsController ],
    providers: [ ReportsService ],
} )
export class ModerationModule {}
