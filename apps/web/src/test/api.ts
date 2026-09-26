/*
 * A fake StudyLog API for tests: answers fetch() by "METHOD /path" and records every call, so tests can check what
 * the app sent. Any call without a handler fails the test.
 */

type Handler = ( init: RequestInit ) => Response | Promise<Response>;

export interface RecordedCall {
    method: string;
    path: string;
    body: unknown;
    headers: Record<string, string>;
    credentials: RequestCredentials | undefined;
}

export function mockApi( handlers: Record<string, Handler> ) {
    const calls: RecordedCall[] = [];

    vi.spyOn( globalThis, 'fetch' ).mockImplementation( async ( input, init = {} ) => {
        const url = new URL( input instanceof Request ? input.url : input );
        const method = init.method ?? 'GET';
        const key = `${method} ${url.pathname}`;
        const handler = handlers[key];

        calls.push( {
            method,
            path: url.pathname,
            body: typeof init.body === 'string' ? JSON.parse( init.body ) : undefined,
            headers: { ...( init.headers as Record<string, string> ) },
            credentials: init.credentials,
        } );
        if ( !handler ) {
            throw new Error( `Unexpected API call: ${key}` );
        }

        return handler( init );
    } );

    return { calls };
}

export function json( status: number, body: unknown, headers: Record<string, string> = {} ): Response {
    return new Response( JSON.stringify( body ), { status, headers: { 'Content-Type': 'application/json', ...headers } } );
}

export function noContent(): Response {
    return new Response( null, { status: 204 } );
}

/** A fetch() that never settles, to see what's shown while a request is in flight. */
export function pending(): Promise<Response> {
    return new Promise( () => undefined );
}

export const USER = {
    id: '97f12719-9f4c-41c9-afc3-a91de613d02b',
    email: 'sam@example.com',
    firstName: 'Sam',
    lastName: 'Khan',
    platformRole: 'application_user',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
};

/** Handlers for "no session yet" at startup. */
export const anonymous = {
    'POST /auth/refresh': () => json( 401, { statusCode: 401, message: 'Unauthorized' } ),
};

/** Handlers for "already logged in" at startup (the refresh cookie is valid). */
export const loggedIn = {
    'POST /auth/refresh': () => json( 200, { accessToken: 'restored-token' } ),
    'GET /auth/me': () => json( 200, USER ),
};
