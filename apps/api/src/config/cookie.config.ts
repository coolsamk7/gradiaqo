import { registerAs } from '@nestjs/config';
import type { CookieOptions } from 'express';

import { validateEnv } from './env.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How the refresh token cookie is set: httpOnly, same-site only, and kept as long as the session.
 * Inject with `@Inject( refreshCookieConfig.KEY )`.
 */
export const refreshCookieConfig = registerAs( 'refreshCookie', (): CookieOptions => {
    const env = validateEnv( process.env );

    return {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: 'strict',
        // Only sent to the auth endpoints, not with every API call.
        path: '/auth',
        maxAge: env.REFRESH_TOKEN_TTL_DAYS * DAY_MS,
    };
} );
