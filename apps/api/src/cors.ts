import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

/**
 * Browser apps allowed to call the API, from `CORS_ORIGINS`: a comma-separated list of exact origins, e.g.
 * `http://localhost:5173,https://app.example.com`. Empty or unset: no cross-origin access.
 *
 * Wildcards aren't allowed: requests carry credentials (the refresh cookie), so every allowed site must be named.
 * Throws on anything that isn't a plain origin, so a typo fails at startup instead of silently blocking the app.
 */
export function parseCorsOrigins( value: string | undefined ): string[] {
    const origins = ( value ?? '' ).split( ',' ).map( ( origin ) => origin.trim() ).filter( Boolean );

    for ( const origin of origins ) {
        let url: URL | undefined;

        try {
            url = new URL( origin );
        } catch {
            // Reported below.
        }
        // An origin is scheme://host[:port] only: no path, query, trailing slash or wildcard.
        // Node's URL parser accepts `*` in a hostname, so wildcards are checked separately.
        if ( !url || ![ 'http:', 'https:' ].includes( url.protocol ) || url.origin !== origin || origin.includes( '*' ) ) {
            throw new Error(
                `Invalid CORS_ORIGINS entry "${origin}": use exact origins like https://app.example.com (no path, `
                + 'trailing slash or *)',
            );
        }
    }

    return [ ...new Set( origins ) ];
}

export function corsOptions( origins: string[] ): CorsOptions {
    return {
        origin: origins,
        // The refresh token is an httpOnly cookie, so the browser must be allowed to send it.
        credentials: true,
        // So the frontend can read the request id (for bug reports), and tell an expired access token (which it can
        // renew) from other 401s (see AuthGuard).
        exposedHeaders: [ 'X-Request-Id', 'WWW-Authenticate' ],
        // Browsers cache the preflight answer this long (seconds).
        maxAge: 600,
    };
}
