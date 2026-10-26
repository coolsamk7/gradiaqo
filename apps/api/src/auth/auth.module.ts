import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '@studylog/database';

import { authConfig } from '../config/auth.config.js';
import { MailModule } from '../mail/mail.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './controllers/auth.controller.js';
import { AuthGuard } from './guards/auth.guard.js';
import { AccountService } from './services/account.service.js';
import { AuthService } from './services/auth.service.js';
import { EmailCodesService } from './services/email-codes.service.js';
import { SessionsService } from './services/sessions.service.js';
import { VerificationService } from './services/verification.service.js';

@Module( {
    imports: [
        UsersModule,
        OrganizationsModule,
        MailModule,
        TypeOrmModule.forFeature( [ Session ] ),
        JwtModule.registerAsync( {
            global: true,
            inject: [ authConfig.KEY ],
            useFactory: ( auth: ConfigType<typeof authConfig> ) => ( {
                secret: auth.jwtSecret,
                signOptions: {
                    expiresIn: auth.jwtExpiresInSeconds,
                },
            } ),
        } ),
    ],
    controllers: [ AuthController ],
    providers: [ AuthService, SessionsService, AccountService, AuthGuard, EmailCodesService, VerificationService ],
    exports: [ AuthGuard, AccountService ],
} )
export class AuthModule {}
