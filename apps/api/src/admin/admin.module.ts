import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AdminOverviewController } from './controllers/admin-overview.controller.js';
import { AdminUsersController } from './controllers/admin-users.controller.js';
import { AdminOverviewService } from './services/admin-overview.service.js';
import { AdminUsersService } from './services/admin-users.service.js';

/** Superadmin pages about the platform as a whole: the overview and users. (The catalog and reports have their own modules.) */
@Module( {
    imports: [ AuthModule ],
    controllers: [ AdminOverviewController, AdminUsersController ],
    providers: [ AdminOverviewService, AdminUsersService ],
} )
export class AdminModule {}
