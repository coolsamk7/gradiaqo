import { validateEnv } from './env.js';

const valid = {
    DATABASE_URL: 'postgresql://studylog:studylog@localhost:5432/studylog',
    JWT_SECRET: 'x'.repeat( 64 ),
};

/** Everything production insists on. */
const production = {
    ...valid,
    NODE_ENV: 'production',
    COOKIE_SECURE: 'true',
    SMTP_HOST: 'smtp-relay.brevo.com',
    SMTP_PORT: '587',
    SMTP_USER: 'me@example.com',
    SMTP_PASSWORD: 'key',
    APP_URL: 'https://app.example.com',
};

describe( 'validateEnv', () => {
    it( 'applies defaults and converts strings to numbers and booleans', () => {
        expect( validateEnv( { ...valid, PORT: '4000', COOKIE_SECURE: 'true', TRUST_PROXY: '1' } ) ).toMatchObject( {
            NODE_ENV: 'development',
            PORT: 4000,
            COOKIE_SECURE: true,
            SWAGGER_ENABLED: false,
            TRUST_PROXY: 1,
            JWT_EXPIRES_IN_SECONDS: 900,
            LOG_LEVEL: 'info',
            RATE_LIMITS_ENABLED: true,
        } );
    } );

    it( 'keeps unrelated environment variables', () => {
        expect( validateEnv( { ...valid, HOME: '/home/me' } ) ).toMatchObject( { HOME: '/home/me' } );
    } );

    it( 'lists every problem at once', () => {
        const attempt = () => validateEnv( { JWT_SECRET: 'change-me', PORT: 'abc', LOG_LEVEL: 'loud' } );

        expect( attempt ).toThrow( 'DATABASE_URL: is required' );
        expect( attempt ).toThrow( 'JWT_SECRET: must be at least 32 characters' );
        expect( attempt ).toThrow( 'PORT: must be integer' );
        expect( attempt ).toThrow( 'LOG_LEVEL: must be one of fatal, error, warn, info, debug, trace, silent' );
    } );

    it( 'rejects a non-postgres database URL and bad CORS origins', () => {
        expect( () => validateEnv( { ...valid, DATABASE_URL: 'mysql://x' } ) ).toThrow( 'DATABASE_URL: must be a postgres:// URL' );
        expect( () => validateEnv( { ...valid, CORS_ORIGINS: '*' } ) ).toThrow( 'CORS_ORIGINS: Invalid CORS_ORIGINS entry' );
    } );

    it( 'allows turning rate limits off, except in production', () => {
        expect( validateEnv( { ...valid, RATE_LIMITS_ENABLED: 'false' } ).RATE_LIMITS_ENABLED ).toBe( false );
        expect( () => validateEnv( { ...production, RATE_LIMITS_ENABLED: 'false' } ) )
            .toThrow( 'RATE_LIMITS_ENABLED: must be true in production' );
    } );

    it( 'requires secure cookies in production', () => {
        expect( () => validateEnv( { ...valid, NODE_ENV: 'production' } ) ).toThrow( 'COOKIE_SECURE: must be true in production' );
        expect( validateEnv( { ...production } ).NODE_ENV ).toBe( 'production' );
    } );

    it( 'sends email through Mailpit by default, and needs a real SMTP relay in production', () => {
        expect( validateEnv( valid ) ).toMatchObject( {
            SMTP_HOST: 'localhost',
            SMTP_PORT: 1025,
            SMTP_SECURE: false,
            SMTP_USER: '',
            MAIL_FROM: 'StudyLog <no-reply@studylog.local>',
        } );
        expect( () => validateEnv( { ...production, SMTP_HOST: 'localhost' } ) ).toThrow( 'SMTP_HOST: must point at the email provider\'s SMTP relay' );
        expect( () => validateEnv( { ...production, SMTP_USER: '' } ) ).toThrow( 'SMTP_HOST: must point at the email provider\'s SMTP relay' );
    } );

    it( 'links emails to the local web app by default, and needs an https address in production', () => {
        expect( validateEnv( valid ).APP_URL ).toBe( 'http://localhost:5173' );
        expect( () => validateEnv( { ...valid, APP_URL: 'app.example.com' } ) )
            .toThrow( 'APP_URL: must be the web app\'s address, e.g. https://app.example.com' );
        expect( () => validateEnv( { ...production, APP_URL: 'http://app.example.com' } ) )
            .toThrow( 'APP_URL: must be an https:// address in production' );
    } );
} );
