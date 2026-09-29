import { ApiError, NetworkError } from '../api/client.ts';
import { expiredToken, json, mockApi } from '../test/api.ts';
import type { SessionEvents } from './authed-request.ts';
import { createAuthedRequests, REFRESH_RETRY_DELAY_MS, renewSession } from './authed-request.ts';

/** Answers GET /things with 200 for the token `valid`, and like an expired token for any other. */
const things = ( init: RequestInit ) => {
    const { Authorization } = init.headers as Record<string, string>;

    return Authorization === 'Bearer valid' ? json( 200, [ 'thing' ] ) : expiredToken();
};

const tokensSent = ( calls: ReturnType<typeof mockApi>['calls'], path = '/things' ) =>
    calls.filter( ( call ) => call.path === path ).map( ( call ) => call.headers.Authorization );

function setup( token = 'old' ) {
    const events = { renewed: vi.fn(), ended: vi.fn() } satisfies SessionEvents;
    const requests = createAuthedRequests( events );

    requests.setToken( token );

    return { ...requests, events };
}

describe( 'createAuthedRequests', () => {
    it( 'sends the access token, and doesn\'t renew a valid one', async () => {
        const { calls } = mockApi( { 'GET /things': things } );
        const { request, events } = setup( 'valid' );

        await expect( request( '/things' ) ).resolves.toEqual( [ 'thing' ] );

        expect( tokensSent( calls ) ).toEqual( [ 'Bearer valid' ] );
        expect( calls ).toHaveLength( 1 );
        expect( events.renewed ).not.toHaveBeenCalled();
    } );

    it( 'sends no token before one is set', async () => {
        const { calls } = mockApi( { 'GET /things': () => json( 200, [] ) } );

        await createAuthedRequests( { renewed: vi.fn(), ended: vi.fn() } ).request( '/things' );

        expect( calls[0]?.headers ).toEqual( {} );
    } );

    it( 'renews an expired token and retries once, with the same method and body', async () => {
        const { calls } = mockApi( {
            'POST /things': things,
            'POST /auth/refresh': () => json( 200, { accessToken: 'valid' } ),
        } );
        const { request, events } = setup();

        await expect( request( '/things', { method: 'POST', body: { name: 'x' } } ) ).resolves.toEqual( [ 'thing' ] );

        expect( calls.map( ( call ) => `${call.method} ${call.path} ${call.headers.Authorization ?? ''}` ) ).toEqual( [
            'POST /things Bearer old', 'POST /auth/refresh ', 'POST /things Bearer valid',
        ] );
        expect( calls.at( -1 )?.body ).toEqual( { name: 'x' } );
        expect( events.renewed ).toHaveBeenCalledExactlyOnceWith( 'valid' );
    } );

    it( 'keeps using the renewed token', async () => {
        const { calls } = mockApi( { 'GET /things': things, 'POST /auth/refresh': () => json( 200, { accessToken: 'valid' } ) } );
        const { request } = setup();

        await request( '/things' );
        await request( '/things' );

        expect( tokensSent( calls ) ).toEqual( [ 'Bearer old', 'Bearer valid', 'Bearer valid' ] );
    } );

    it( 'renews once for requests that expire together', async () => {
        let finishRefresh!: () => void;
        const { calls } = mockApi( {
            'GET /things': things,
            'POST /auth/refresh': () => new Promise( ( resolve ) => {
                finishRefresh = () => resolve( json( 200, { accessToken: 'valid' } ) );
            } ),
        } );
        const { request } = setup();

        const results = Promise.all( [ request( '/things' ), request( '/things' ), request( '/things' ) ] );

        await vi.waitFor( () => expect( finishRefresh ).toBeDefined() );
        await vi.waitFor( () => expect( tokensSent( calls ) ).toHaveLength( 3 ) );
        finishRefresh();

        await expect( results ).resolves.toEqual( [ [ 'thing' ], [ 'thing' ], [ 'thing' ] ] );
        expect( calls.filter( ( call ) => call.path === '/auth/refresh' ) ).toHaveLength( 1 );
    } );

    it( 'retries straight away with the token another request already renewed', async () => {
        let answerSlow: ( () => void ) | undefined;
        const { calls } = mockApi( {
            // The first call hangs until answered (expired); the retry is answered normally.
            'GET /slow': ( init ) => ( answerSlow
                ? things( init )
                : new Promise( ( resolve ) => {
                        answerSlow = () => resolve( expiredToken() );
                    } ) ),
            'GET /things': things,
            'POST /auth/refresh': () => json( 200, { accessToken: 'valid' } ),
        } );
        const { request } = setup();

        const slow = request( '/slow' );

        await vi.waitFor( () => expect( answerSlow ).toBeDefined() );
        await request( '/things' );
        answerSlow?.();
        await expect( slow ).resolves.toEqual( [ 'thing' ] );

        expect( calls.filter( ( call ) => call.path === '/auth/refresh' ) ).toHaveLength( 1 );
        expect( tokensSent( calls, '/slow' ) ).toEqual( [ 'Bearer old', 'Bearer valid' ] );
    } );

    it( 'starts a new renewal once the previous one is done', async () => {
        let next = 1;
        const { calls } = mockApi( {
            'GET /things': () => expiredToken(),
            'POST /auth/refresh': () => json( 200, { accessToken: `new-${next++}` } ),
        } );
        const { request } = setup();

        await expect( request( '/things' ) ).rejects.toThrow( ApiError );
        await expect( request( '/things' ) ).rejects.toThrow( ApiError );

        expect( tokensSent( calls ) ).toEqual( [ 'Bearer old', 'Bearer new-1', 'Bearer new-1', 'Bearer new-2' ] );
    } );

    it.each( [
        [ 'a wrong password', () => json( 401, { message: 'Wrong password' } ) ],
        [ 'a forbidden action', () => json( 403, { message: 'Forbidden' } ) ],
        [ 'no connection', () => Promise.reject( new TypeError( 'offline' ) ) ],
    ] )( 'passes other errors through without renewing: %s', async ( _, handler ) => {
        const { calls } = mockApi( { 'GET /things': handler } );
        const { request, events } = setup();

        await expect( request( '/things' ) ).rejects.toThrow();

        expect( calls ).toHaveLength( 1 );
        expect( events.ended ).not.toHaveBeenCalled();
    } );

    it( 'ends the session when it can\'t be renewed, and rejects with the 401', async () => {
        vi.useFakeTimers( { shouldAdvanceTime: true } );
        const { calls } = mockApi( {
            'GET /things': things,
            'POST /auth/refresh': () => json( 401, { message: 'Unauthorized' } ),
        } );
        const { request, events } = setup();

        const result = request( '/things' ).catch( ( error: unknown ) => error );

        await vi.advanceTimersByTimeAsync( REFRESH_RETRY_DELAY_MS );

        expect( await result ).toMatchObject( { status: 401 } );
        expect( events.ended ).toHaveBeenCalledOnce();
        expect( events.renewed ).not.toHaveBeenCalled();
        expect( calls.filter( ( call ) => call.path === '/auth/refresh' ) ).toHaveLength( 2 );

        // The token is gone: the next request goes without one.
        mockApi( { 'GET /things': ( init ) => json( 200, init.headers ) } );
        await expect( request( '/things' ) ).resolves.toEqual( {} );
        vi.useRealTimers();
    } );

    it( 'stays logged in when the API can\'t be reached for renewing', async () => {
        mockApi( { 'GET /things': things, 'POST /auth/refresh': () => Promise.reject( new TypeError( 'offline' ) ) } );
        const { request, events } = setup();

        await expect( request( '/things' ) ).rejects.toThrow( NetworkError );

        expect( events.ended ).not.toHaveBeenCalled();
    } );
} );

describe( 'renewSession', () => {
    afterEach( () => {
        vi.useRealTimers();
    } );

    it( 'retries a lost race with another tab once, a moment later', async () => {
        vi.useFakeTimers();
        let attempt = 0;
        const { calls } = mockApi( {
            'POST /auth/refresh': () => ( ++attempt === 1 ? json( 401, { message: 'Unauthorized' } ) : json( 200, { accessToken: 'won' } ) ),
        } );

        const renewed = renewSession();

        await vi.advanceTimersByTimeAsync( REFRESH_RETRY_DELAY_MS - 1 );
        expect( calls ).toHaveLength( 1 );
        await vi.advanceTimersByTimeAsync( 1 );

        await expect( renewed ).resolves.toBe( 'won' );
        expect( calls ).toHaveLength( 2 );
    } );

    it( 'doesn\'t retry other failures', async () => {
        const { calls } = mockApi( { 'POST /auth/refresh': () => json( 500, { message: 'Internal server error' } ) } );

        await expect( renewSession() ).rejects.toMatchObject( { status: 500 } );
        expect( calls ).toHaveLength( 1 );
    } );
} );
