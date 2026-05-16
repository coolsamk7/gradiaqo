import { registerAs } from '@nestjs/config';
import { NestJsInngestOptions } from '@gradiaqo/nestjs-inngest';

export const inngestConfig = registerAs( 'inngest.config', (): NestJsInngestOptions => {
    const env = process.env;

    const allowedLogLevels = [ 'debug', 'info', 'warn', 'error' ] as const;
    type LogLevel = ( typeof allowedLogLevels )[number];

    const level = env['INNGEST_LOG_LEVEL']?.toLowerCase() ?? '';
    const logLevel = allowedLogLevels.includes( level as LogLevel ) ? ( level as LogLevel ) : 'info';
    return {
        clientOptions: {
            id: env['INNGEST_APP_ID'],
            env: env['INNGEST_ENV'],
            baseUrl: env['INNGEST_BASE_URL'] ?? 'http://localhost:8288',
            eventKey: env['INNGEST_EVENT_KEY'],
        },
        serveOptions: {
            servePath: env['INNGEST_SERVE_PATH'] ?? '/api/inngest',
            signingKey: env['INNGEST_SIGNING_KEY'],
            logLevel: logLevel,
        },
    };
} );
