import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AdminUsersController } from './controllers/admin-users.controller.js';
import { AdminUsersService } from './services/admin-users.service.js';

/** Superadmin pages about the platform as a whole: users. (The catalog and reports have their own modules.) */
@Module( {
    imports: [ AuthModule ],
    controllers: [ AdminUsersController ],
    providers: [ AdminUsersService ],
} )
export class AdminModule {}
