import { registerAs } from '@nestjs/config';

import { parseCorsOrigins } from '../cors.js';
import { validateEnv } from './env.js';

/** How the API serves HTTP, and where the web app is. Inject with `@Inject( appConfig.KEY )`. */
export const appConfig = registerAs( 'app', () => {
    const env = validateEnv( process.env );

    return {
        port: env.PORT,
        trustProxy: env.TRUST_PROXY,
        corsOrigins: parseCorsOrigins( env.CORS_ORIGINS ),
        swaggerEnabled: env.SWAGGER_ENABLED,
        rateLimitsEnabled: env.RATE_LIMITS_ENABLED,
        /** The web app's address without a trailing slash, for links in emails. */
        webAppUrl: env.APP_URL.replace( /\/+$/, '' ),
    };
} );
