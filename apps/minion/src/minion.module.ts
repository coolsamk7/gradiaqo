import { Module } from '@nestjs/common';
import { NestjsInngestModule } from '@gradiaqo/nestjs-inngest';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { inngestConfig } from './config/inngest.config';
import { LoggerModule } from 'nestjs-pino';
import { loggerConfig } from './config/logger.config';
import { databaseConfig } from './config/database.config';
import { smtpConfig } from './config/smtp.config';
import { UsersModule } from './modules/users/users.module';

@Module( {
    imports: [
        ConfigModule.forRoot( {
            isGlobal: true,
            load: [ inngestConfig, loggerConfig, databaseConfig, smtpConfig ],
            envFilePath: [ '.env' ],
        } ),
        NestjsInngestModule.forRootAsync( {
            imports: [ ConfigModule ],
            inject: [ ConfigService ],
            useFactory( configService: ConfigService ) {
                return configService.getOrThrow( 'inngest.config' );
            },
        } ),
        LoggerModule.forRootAsync( {
            imports: [ ConfigModule ],
            inject: [ ConfigService ],
            useFactory( configService: ConfigService ) {
                return configService.getOrThrow( 'logger.config' );
            },
        } ),
        TypeOrmModule.forRootAsync( {
            imports: [ ConfigModule ],
            inject: [ ConfigService ],
            useFactory( configService: ConfigService ) {
                return configService.getOrThrow( 'database.config' );
            },
        } ),
        UsersModule,
    ],
    providers: [
    ],
} )
export class MinionModule {}
