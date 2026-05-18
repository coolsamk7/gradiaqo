import { UserEmailOtpEntity, UserEntity } from '@gradiaqo/nestjs-database/entities';
import { KeycloakModule } from '@gradiaqo/nestjs-keycloak-admin';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './controller';
import { AuthService } from './service';

@Module( {
    imports: [
        TypeOrmModule.forFeature( [ UserEntity, UserEmailOtpEntity ] ),
        ThrottlerModule.forRootAsync( {
            imports: [ ConfigModule ],
            inject: [ ConfigService ],
            useFactory( configService: ConfigService ) {
                return configService.getOrThrow( 'otp-throttler.config' );
            },
        } ),
        KeycloakModule.forRootAsync( {
            imports: [ ConfigModule ],
            inject: [ ConfigService ],
            useFactory( configService: ConfigService ) {
                return configService.getOrThrow( 'keycloak.config' );
            },
        } ),
    ],
    controllers: [ AuthController ],
    providers: [ AuthService ],
} )
export class AuthModule {}
