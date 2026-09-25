import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Params } from 'nestjs-pino';

export const REQUEST_ID_HEADER = 'x-request-id';

export interface LoggerOptions {
    /** Shown as `service` on every log line, e.g. "studylog-api". */
    service: string;
    /** trace | debug | info | warn | error | fatal | silent */
    level?: string;
    /** Colored single-line output for local development. Keep false in production (JSON logs). */
    pretty?: boolean;
    /** Paths not to log requests for, e.g. [ '/docs' ]. Matched as prefixes. */
    ignorePaths?: string[];
}

// What the app's auth/organization guards attach to the request, read for log context.
interface RequestContext {
    user?: { sub: string };
    organization?: { organizationId: string };
}

type Request = IncomingMessage & RequestContext & { id?: unknown; originalUrl?: string };

// Only reuse an incoming request id if it looks like one; anything else could forge log lines.
const SAFE_REQUEST_ID = /^[\w.-]{1,128}$/;

/**
 * Shared nestjs-pino setup for every StudyLog NestJS app.
 *
 * - One log line per request, with a request id (also returned as `X-Request-Id`),
 *   status, duration, and the user/organization when known.
 * - 5xx → error, 4xx → warn, everything else → info.
 * - Tokens, cookies and passwords are always redacted.
 */
export function createLoggerOptions( { service, level = 'info', pretty = false, ignorePaths = [] }: LoggerOptions ): Params {
    return {
        pinoHttp: {
            level,
            base: { service },
            genReqId: ( req: IncomingMessage, res: ServerResponse ) => {
                const incoming = req.headers[REQUEST_ID_HEADER];
                const id = typeof incoming === 'string' && SAFE_REQUEST_ID.test( incoming ) ? incoming : randomUUID();

                res.setHeader( 'X-Request-Id', id );

                return id;
            },
            customLogLevel: ( _req, res, error ) => {
                if ( error || res.statusCode >= 500 ) {
                    return 'error';
                }

                return res.statusCode >= 400 ? 'warn' : 'info';
            },
            customSuccessMessage: ( req, res, responseTime ) =>
                `${req.method} ${( req as Request ).originalUrl ?? req.url} ${res.statusCode} ${Math.round( responseTime )}ms`,
            customErrorMessage: ( req, res, error ) =>
                `${req.method} ${( req as Request ).originalUrl ?? req.url} ${res.statusCode} ${error.message}`,
            // Evaluated when the response finishes, so the auth/organization guards have already run.
            customProps: ( req ) => {
                const { user, organization } = req as Request;

                return {
                    ...( user && { userId: user.sub } ),
                    ...( organization && { organizationId: organization.organizationId } ),
                };
            },
            serializers: {
                req: ( req: { id: string; method: string; url: string; headers: Record<string, unknown> } ) => ( {
                    id: req.id,
                    method: req.method,
                    url: req.url,
                    userAgent: req.headers['user-agent'],
                } ),
                res: ( res: { statusCode: number } ) => ( { statusCode: res.statusCode } ),
            },
            redact: {
                paths: [
                    'req.headers.authorization',
                    'req.headers.cookie',
                    'res.headers["set-cookie"]',
                    '*.password',
                    '*.passwordHash',
                    '*.accessToken',
                    '*.refreshToken',
                    '*.token',
                ],
                censor: '[REDACTED]',
            },
            autoLogging: {
                ignore: ( req ) => ignorePaths.some( ( path ) => ( req.url ?? '' ).startsWith( path ) ),
            },
            transport: pretty
                ? {
                        target: 'pino-pretty',
                        options: {
                            colorize: true,
                            singleLine: true,
                            translateTime: 'SYS:HH:MM:ss.l',
                            ignore: 'pid,hostname,service,req,res,responseTime',
                        },
                    }
                : undefined,
        },
    };
}
