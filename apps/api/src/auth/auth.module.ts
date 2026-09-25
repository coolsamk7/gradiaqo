import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '@studylog/database';

import { OrganizationsModule } from '../organizations/organizations.module.js';
import { UsersModule } from '../users/users.module.js';
import { AccountService } from './account.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { SessionsService } from './sessions.service.js';

@Module( {
    imports: [
        UsersModule,
        OrganizationsModule,
        TypeOrmModule.forFeature( [ Session ] ),
        JwtModule.registerAsync( {
            global: true,
            inject: [ ConfigService ],
            useFactory: ( config: ConfigService ) => ( {
                secret: config.getOrThrow<string>( 'JWT_SECRET' ),
                signOptions: {
                    expiresIn: Number( config.get( 'JWT_EXPIRES_IN_SECONDS', 900 ) ),
                },
            } ),
        } ),
    ],
    controllers: [ AuthController ],
    providers: [ AuthService, SessionsService, AccountService, AuthGuard ],
    exports: [ AuthGuard ],
} )
export class AuthModule {}
