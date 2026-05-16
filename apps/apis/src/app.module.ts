import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { loggerConfig, inngestConfig } from './config';
import { LoggerModule } from 'nestjs-pino';
import { NestjsInngestModule } from '@gradiaqo/nestjs-inngest';

@Module( {
    imports: [
        ConfigModule.forRoot( {
            isGlobal: true,
            load: [ loggerConfig, inngestConfig ]
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
        } )
    ],
    controllers: [],
    providers: [],
} )
export class AppModule {}
