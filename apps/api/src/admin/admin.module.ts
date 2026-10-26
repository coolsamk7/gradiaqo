import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AdminOrganizationsController } from './controllers/admin-organizations.controller.js';
import { AdminOverviewController } from './controllers/admin-overview.controller.js';
import { AdminUsersController } from './controllers/admin-users.controller.js';
import { AdminOrganizationsService } from './services/admin-organizations.service.js';
import { AdminOverviewService } from './services/admin-overview.service.js';
import { AdminUsersService } from './services/admin-users.service.js';

/**
 * Superadmin pages about the platform as a whole: the overview, users and organizations. (The catalog and reports
 * have their own modules.)
 */
@Module( {
    imports: [ AuthModule ],
    controllers: [ AdminOverviewController, AdminUsersController, AdminOrganizationsController ],
    providers: [ AdminOverviewService, AdminUsersService, AdminOrganizationsService ],
} )
export class AdminModule {}
