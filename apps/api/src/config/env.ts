import type { Static } from 'typebox';
import Type from 'typebox';
import { Compile } from 'typebox/compile';

import { parseCorsOrigins } from '../cors.js';

const Flag = ( defaultValue: boolean ) => Type.Boolean( { default: defaultValue } );

/**
 * Every setting the API reads, checked once at startup. Values from `.env` / the environment are strings; they're
 * converted to numbers and booleans here, so code reads typed values from ConfigService.
 */
export const Env = Type.Object( {
    NODE_ENV: Type.Union( [ Type.Literal( 'development' ), Type.Literal( 'production' ), Type.Literal( 'test' ) ], {
        default: 'development',
    } ),
    PORT: Type.Integer( { minimum: 1, maximum: 65_535, default: 3000 } ),
    DATABASE_URL: Type.String( { pattern: '^postgres(ql)?://', errorMessage: 'must be a postgres:// URL' } ),
    // HMAC key for access tokens: long enough that it can't be guessed. Generate: openssl rand -base64 48
    JWT_SECRET: Type.String( { minLength: 32, errorMessage: 'must be at least 32 characters (openssl rand -base64 48)' } ),
    JWT_EXPIRES_IN_SECONDS: Type.Integer( { minimum: 60, maximum: 86_400, default: 900 } ),
    REFRESH_TOKEN_TTL_DAYS: Type.Integer( { minimum: 1, maximum: 365, default: 180 } ),
    COOKIE_SECURE: Flag( false ),
    SWAGGER_ENABLED: Flag( false ),
    CORS_ORIGINS: Type.String( { default: '' } ),
    // Number of reverse proxies (load balancer, CDN) in front of the API, so client IPs (for rate limits and logs)
    // are read from X-Forwarded-For. 0 when the API is reached directly; never higher than the real number.
    TRUST_PROXY: Type.Integer( { minimum: 0, maximum: 10, default: 0 } ),
    LOG_LEVEL: Type.Union(
        [ 'fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent' ].map( ( level ) => Type.Literal( level ) ),
        { default: 'info' },
    ),
    LOG_PRETTY: Flag( false ),
} );
export type Env = Static<typeof Env>;

const validator = Compile( Env );

/**
 * `validate` for ConfigModule: applies defaults, converts types and checks every setting, plus rules that span
 * settings. Throws one error listing every problem, so a misconfigured deployment fails at startup, not later.
 */
export function validateEnv( raw: Record<string, unknown> ): Env {
    const value = validator.Convert( validator.Default( { ...raw } ) );
    const problems = new Map<string, string>();

    for ( const error of validator.Errors( value ) ) {
        const missing = ( error.params as { requiredProperties?: string[] } ).requiredProperties;

        for ( const key of missing ?? [ error.instancePath.slice( 1 ) ] ) {
            if ( !problems.has( key ) ) {
                problems.set( key, missing ? 'is required' : describe( key, error.message ) );
            }
        }
    }

    if ( problems.size === 0 ) {
        const env = value as Env;

        if ( env.NODE_ENV === 'production' && !env.COOKIE_SECURE ) {
            problems.set( 'COOKIE_SECURE', 'must be true in production (the refresh cookie must only travel over HTTPS)' );
        }
        try {
            parseCorsOrigins( env.CORS_ORIGINS );
        } catch ( err ) {
            problems.set( 'CORS_ORIGINS', ( err as Error ).message );
        }
    }
    if ( problems.size > 0 ) {
        const lines = [ ...problems ].map( ( [ key, message ] ) => `${key}: ${message}` );

        throw new Error( `Invalid configuration:\n  - ${lines.join( '\n  - ' )}` );
    }

    return value as Env;
}

/** The setting's own `errorMessage`, the allowed values for a choice, or TypeBox's message. */
function describe( key: string, fallback: string ): string {
    const schema = ( Env.properties as Record<string, { errorMessage?: string; anyOf?: { const?: unknown }[] }> )[key];

    if ( schema?.errorMessage ) {
        return schema.errorMessage;
    }
    if ( schema?.anyOf ) {
        return `must be one of ${schema.anyOf.map( ( option ) => String( option.const ) ).join( ', ' )}`;
    }

    return fallback;
}
