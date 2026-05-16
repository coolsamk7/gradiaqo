import { registerAs } from '@nestjs/config';
import { Params } from 'nestjs-pino';

export const loggerConfig = registerAs( 'logger.config', (): Params => {
    return {
        pinoHttp: {
            transport: {
                target: 'pino-pretty',
            },
        },
    };
} );
