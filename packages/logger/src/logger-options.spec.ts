import type { IncomingMessage, ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { createLoggerOptions } from './logger-options.js';

interface PinoHttp {
    genReqId: ( req: IncomingMessage, res: ServerResponse ) => string;
    customLogLevel: ( req: unknown, res: { statusCode: number }, error?: Error ) => string;
    customProps: ( req: unknown ) => object;
    autoLogging: { ignore: ( req: { url?: string } ) => boolean };
    redact: { paths: string[] };
    level: string;
    transport?: unknown;
}

const pinoHttp = ( options = {} ) => createLoggerOptions( { service: 'test', ...options } ).pinoHttp as unknown as PinoHttp;

describe( 'createLoggerOptions', () => {
    describe( 'request ids', () => {
        const withHeader = ( value?: string ) => {
            const res = { setHeader: vi.fn() };
            const id = pinoHttp().genReqId(
                { headers: value ? { 'x-request-id': value } : {} } as IncomingMessage,
                res as unknown as ServerResponse,
            );

            return { id, res };
        };

        it( 'reuses a well-formed incoming X-Request-Id and returns it', () => {
            const { id, res } = withHeader( 'trace-abc.123' );

            expect( id ).toBe( 'trace-abc.123' );
            expect( res.setHeader ).toHaveBeenCalledWith( 'X-Request-Id', 'trace-abc.123' );
        } );

        it( 'replaces a missing or unsafe one (it could forge log lines) with a new UUID', () => {
            for ( const unsafe of [ undefined, 'line\nbreak', 'x'.repeat( 200 ), '<script>' ] ) {
                expect( withHeader( unsafe ).id ).toMatch( /^[0-9a-f-]{36}$/ );
            }
        } );
    } );

    it( 'logs 5xx and errors as error, 4xx as warn, the rest as info', () => {
        const level = pinoHttp().customLogLevel;

        expect( level( {}, { statusCode: 500 } ) ).toBe( 'error' );
        expect( level( {}, { statusCode: 200 }, new Error( 'boom' ) ) ).toBe( 'error' );
        expect( level( {}, { statusCode: 404 } ) ).toBe( 'warn' );
        expect( level( {}, { statusCode: 201 } ) ).toBe( 'info' );
    } );

    it( 'adds the user and organization when known', () => {
        const props = pinoHttp().customProps;

        expect( props( {} ) ).toEqual( {} );
        expect( props( { user: { sub: 'u' }, organization: { organizationId: 'o' } } ) ).toEqual( { userId: 'u', organizationId: 'o' } );
    } );

    it( 'always redacts credentials', () => {
        expect( pinoHttp().redact.paths ).toEqual( expect.arrayContaining( [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            '*.password',
            '*.refreshToken',
        ] ) );
    } );

    it( 'skips logging for ignored path prefixes', () => {
        const { ignore } = pinoHttp( { ignorePaths: [ '/docs', '/health' ] } ).autoLogging;

        expect( ignore( { url: '/docs/json' } ) ).toBe( true );
        expect( ignore( { url: '/health' } ) ).toBe( true );
        expect( ignore( { url: '/auth/login' } ) ).toBe( false );
    } );

    it( 'uses JSON unless pretty output is asked for', () => {
        expect( pinoHttp().transport ).toBeUndefined();
        expect( pinoHttp( { pretty: true } ).transport ).toMatchObject( { target: 'pino-pretty' } );
    } );

    it( 'writes one short message per request, with the original URL (before any rewrite)', () => {
        const options = pinoHttp() as unknown as {
            customSuccessMessage: ( req: object, res: object, time: number ) => string;
            customErrorMessage: ( req: object, res: object, error: Error ) => string;
        };

        expect( options.customSuccessMessage( { method: 'GET', url: '/x', originalUrl: '/api/x' }, { statusCode: 200 }, 12.4 ) )
            .toBe( 'GET /api/x 200 12ms' );
        expect( options.customSuccessMessage( { method: 'GET', url: '/x' }, { statusCode: 200 }, 3 ) ).toBe( 'GET /x 200 3ms' );
        expect( options.customErrorMessage( { method: 'POST', url: '/y' }, { statusCode: 500 }, new Error( 'boom' ) ) )
            .toBe( 'POST /y 500 boom' );
        expect( options.customErrorMessage( { method: 'POST', url: '/y', originalUrl: '/api/y' }, { statusCode: 500 }, new Error( 'boom' ) ) )
            .toBe( 'POST /api/y 500 boom' );
    } );

    it( 'logs only the request id, method, URL and user agent, and the response status', () => {
        interface Serializers { serializers: { req: ( r: object ) => object; res: ( r: object ) => object } }
        const { serializers } = pinoHttp() as unknown as Serializers;

        expect( serializers.req( {
            id: 'r1', method: 'GET', url: '/x', headers: { 'user-agent': 'curl', authorization: 'Bearer secret', cookie: 'c' },
        } ) ).toEqual( { id: 'r1', method: 'GET', url: '/x', userAgent: 'curl' } );
        expect( serializers.res( { statusCode: 204, headers: { 'set-cookie': 'x' } } ) ).toEqual( { statusCode: 204 } );
    } );

    it( 'logs requests without a URL', () => {
        expect( pinoHttp( { ignorePaths: [ '/docs' ] } ).autoLogging.ignore( {} ) ).toBe( false );
    } );
} );
