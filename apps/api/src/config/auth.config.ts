import { registerAs } from '@nestjs/config';

import { validateEnv } from './env.js';

/** Access tokens and refresh sessions. Inject with `@Inject( authConfig.KEY )`. */
export const authConfig = registerAs( 'auth', () => {
    const env = validateEnv( process.env );

    return {
        jwtSecret: env.JWT_SECRET,
        jwtExpiresInSeconds: env.JWT_EXPIRES_IN_SECONDS,
        refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
    };
} );
