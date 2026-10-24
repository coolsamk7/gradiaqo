import { appConfig } from '../../../src/config/app.config.js';
import { authConfig } from '../../../src/config/auth.config.js';
import { refreshCookieConfig } from '../../../src/config/cookie.config.js';
import { databaseConfig } from '../../../src/config/database.config.js';
import { mailConfig } from '../../../src/config/mail.config.js';

/*
 * Each config reads process.env (where ConfigModule put .env), applies defaults and converts types like validateEnv.
 */

const DATABASE_URL = 'postgresql://studylog:studylog@localhost:5432/studylog';
const JWT_SECRET = 'x'.repeat( 64 );

describe( 'configs', () => {
    beforeEach( () => {
        vi.stubEnv( 'DATABASE_URL', DATABASE_URL );
        vi.stubEnv( 'JWT_SECRET', JWT_SECRET );
    } );

    afterEach( () => {
        vi.unstubAllEnvs();
    } );

    it( 'app: typed values, CORS origins as a list, and the web app URL without a trailing slash', () => {
        vi.stubEnv( 'PORT', '4000' );
        vi.stubEnv( 'TRUST_PROXY', '1' );
        vi.stubEnv( 'CORS_ORIGINS', 'https://a.example.com, https://b.example.com' );
        vi.stubEnv( 'SWAGGER_ENABLED', 'true' );
        vi.stubEnv( 'RATE_LIMITS_ENABLED', 'false' );
        vi.stubEnv( 'APP_URL', 'https://app.example.com//' );

        expect( appConfig() ).toEqual( {
            port: 4000,
            trustProxy: 1,
            corsOrigins: [ 'https://a.example.com', 'https://b.example.com' ],
            swaggerEnabled: true,
            rateLimitsEnabled: false,
            webAppUrl: 'https://app.example.com',
        } );
    } );

    it( 'auth: secret and token lifetimes, with defaults', () => {
        expect( authConfig() ).toEqual( {
            jwtSecret: JWT_SECRET,
            jwtExpiresInSeconds: 900,
            refreshTokenTtlDays: 180,
        } );
    } );

    it( 'refreshCookie: httpOnly, same-site, scoped to /auth, secure as configured, and kept as long as the session', () => {
        vi.stubEnv( 'COOKIE_SECURE', 'true' );
        vi.stubEnv( 'REFRESH_TOKEN_TTL_DAYS', '30' );

        expect( refreshCookieConfig() ).toEqual( {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            path: '/auth',
            maxAge: 30 * 24 * 60 * 60 * 1000,
        } );
    } );

    it( 'database: the connection URL', () => {
        expect( databaseConfig() ).toEqual( { url: DATABASE_URL } );
    } );

    it( 'mail: the SMTP server, login and sender', () => {
        vi.stubEnv( 'SMTP_HOST', 'smtp-relay.brevo.com' );
        vi.stubEnv( 'SMTP_PORT', '587' );
        vi.stubEnv( 'SMTP_USER', 'me@example.com' );
        vi.stubEnv( 'SMTP_PASSWORD', 'key' );

        expect( mailConfig() ).toEqual( {
            host: 'smtp-relay.brevo.com',
            port: 587,
            secure: false,
            user: 'me@example.com',
            password: 'key',
            from: 'StudyLog <no-reply@studylog.local>',
        } );
    } );

    it( 'fails like validateEnv when a setting is invalid', () => {
        vi.stubEnv( 'JWT_SECRET', 'short' );

        expect( () => authConfig() ).toThrow( 'JWT_SECRET: must be at least 32 characters' );
    } );
} );
