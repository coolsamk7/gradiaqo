import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '@studylog/database';

import { MailModule } from '../mail/mail.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { UsersModule } from '../users/users.module.js';
import { AccountService } from './account.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { EmailCodesService } from './email-codes.service.js';
import { SessionsService } from './sessions.service.js';
import { VerificationService } from './verification.service.js';

@Module( {
    imports: [
        UsersModule,
        OrganizationsModule,
        MailModule,
        TypeOrmModule.forFeature( [ Session ] ),
        JwtModule.registerAsync( {
            global: true,
            inject: [ ConfigService ],
            useFactory: ( config: ConfigService ) => ( {
                secret: config.getOrThrow<string>( 'JWT_SECRET' ),
                signOptions: {
                    expiresIn: config.getOrThrow<number>( 'JWT_EXPIRES_IN_SECONDS' ),
                },
            } ),
        } ),
    ],
    controllers: [ AuthController ],
    providers: [ AuthService, SessionsService, AccountService, AuthGuard, EmailCodesService, VerificationService ],
    exports: [ AuthGuard ],
} )
export class AuthModule {}
