import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { loggerConfig } from './config/logger.config';
import { LoggerModule } from 'nestjs-pino';

@Module( {
    imports: [
        ConfigModule.forRoot( {
            isGlobal: true,
            load: [ loggerConfig ]
        } ),
        LoggerModule.forRootAsync( {
            imports: [ ConfigModule ],
            inject: [ ConfigService ],
            useFactory: ( configService: ConfigService ) => 
                configService.getOrThrow( 'logger.config' )
        } )
    ],
    controllers: [],
    providers: [],
} )
export class AppModule {}
