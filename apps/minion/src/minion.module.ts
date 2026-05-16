import { Module } from '@nestjs/common';
import { NestjsInngestModule } from '@gradiaqo/nestjs-inngest';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { inngestConfig } from './config/inngest.config';
import { LoggerModule } from 'nestjs-pino';
import { loggerConfig } from './config/logger.config';

@Module( {
    imports: [
        ConfigModule.forRoot( {
            isGlobal: true,
            load: [ inngestConfig, loggerConfig ],
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
    ],
    providers: [
    ],
} )
export class MinionModule {}
