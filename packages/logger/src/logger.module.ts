import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import type { LoggerOptions } from './logger-options.js';
import { createLoggerOptions } from './logger-options.js';

export type LoggerModuleOptions = Pick<LoggerOptions, 'service' | 'ignorePaths'>;

/**
 * Pino logging for a Gradiaqo NestJS app. Reads `LOG_LEVEL` and `LOG_PRETTY` from config.
 *
 * @example
 * imports: [ ConfigModule.forRoot( { isGlobal: true } ), LoggerModule.forRoot( { service: 'studylog-api' } ) ]
 */
@Module( {} )
export class LoggerModule {
    static forRoot( options: LoggerModuleOptions ): DynamicModule {
        return {
            module: LoggerModule,
            imports: [
                PinoLoggerModule.forRootAsync( {
                    inject: [ ConfigService ],
                    useFactory: ( config: ConfigService ) =>
                        createLoggerOptions( {
                            ...options,
                            level: config.get( 'LOG_LEVEL', 'info' ),
                            // A boolean when the app validates its config, the raw string otherwise.
                            pretty: String( config.get( 'LOG_PRETTY' ) ) === 'true',
                        } ),
                } ),
            ],
            exports: [ PinoLoggerModule ],
        };
    }
}
