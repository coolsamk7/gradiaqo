import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { loggerConfig, inngestConfig, databaseConfig, keycloakConfig } from './config';
import { LoggerModule } from 'nestjs-pino';
import { NestjsInngestModule } from '@gradiaqo/nestjs-inngest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';

@Module( {
    imports: [
        ConfigModule.forRoot( {
            isGlobal: true,
            envFilePath: [ '.env' ],
            load: [ loggerConfig, inngestConfig, databaseConfig, keycloakConfig ]
        } ),
        LoggerModule.forRootAsync( {
            imports: [ ConfigModule ],
            inject: [ ConfigService ],
            useFactory: ( configService: ConfigService ) => 
                configService.getOrThrow( 'logger.config' )
        } ),
        NestjsInngestModule.forRootAsync( {
            imports: [ ConfigModule ],
            inject: [ ConfigService ],
            useFactory: ( configService: ConfigService ) => configService.getOrThrow( "inngest.config" )
        } ),
        TypeOrmModule.forRootAsync( {
            imports: [ ConfigModule ],
            inject: [ ConfigService ],
            async useFactory( configService: ConfigService ) {
                return configService.getOrThrow( 'database.config' );
            },
        } ),
        AuthModule
    ],
    controllers: [],
    providers: [],
} )
export class AppModule {}
