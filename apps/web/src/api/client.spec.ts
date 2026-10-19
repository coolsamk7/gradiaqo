import { json, mockApi, noContent } from '../test/api.ts';
import { ApiError, apiRequest, NetworkError } from './client.ts';

describe( 'apiRequest', () => {
    it( 'sends cookies and JSON, with the access token when given, and returns the JSON body', async () => {
        const { calls } = mockApi( { 'POST /things': () => json( 201, { id: 't1' } ) } );

        await expect( apiRequest( '/things', { method: 'POST', body: { name: 'X' }, accessToken: 'token' } ) ).resolves.toEqual( { id: 't1' } );
        expect( calls[0] ).toEqual( {
            method: 'POST',
            path: '/things',
            query: '',
            body: { name: 'X' },
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
            credentials: 'include',
        } );
    } );

    it( 'sends GET without a body or content type by default', async () => {
        const { calls } = mockApi( { 'GET /things': () => json( 200, [] ) } );

        await apiRequest( '/things' );

        expect( calls[0] ).toMatchObject( { method: 'GET', body: undefined, headers: {} } );
    } );

    it( 'returns undefined for 204 No Content', async () => {
        mockApi( { 'POST /auth/logout': () => noContent() } );

        await expect( apiRequest( '/auth/logout', { method: 'POST' } ) ).resolves.toBeUndefined();
    } );

    it( 'rejects with NetworkError when the API can\'t be reached', async () => {
        vi.spyOn( globalThis, 'fetch' ).mockRejectedValue( new TypeError( 'Failed to fetch' ) );

        await expect( apiRequest( '/things' ) ).rejects.toThrow( NetworkError );
    } );

    describe( 'errors', () => {
        const failWith = async ( response: Response ) => {
            mockApi( { 'GET /things': () => response } );

            return apiRequest( '/things' ).catch( ( error: unknown ) => error as ApiError );
        };

        it( 'carries the status, message and the first message per field', async () => {
            const error = await failWith( json( 400, {
                message: 'Validation failed (body)',
                errors: [
                    { path: '/email', message: 'must be a valid email address' },
                    { path: '/email', message: 'is too long' },
                    { path: '/password', message: 'is required' },
                ],
            } ) );

            expect( error ).toBeInstanceOf( ApiError );
            expect( error ).toMatchObject( {
                status: 400,
                message: 'Validation failed (body)',
                fieldErrors: { email: 'must be a valid email address', password: 'is required' },
                retryAfterSeconds: undefined,
                invalidToken: false,
            } );
        } );

        it.each( [
            [ 'an expired or invalid token', 401, 'Bearer error="invalid_token"', true ],
            [ 'a missing token', 401, 'Bearer', true ],
            [ 'a wrong password (no challenge)', 401, undefined, false ],
            [ 'another scheme', 401, 'Basic realm="x"', false ],
            [ 'another scheme that mentions Bearer', 401, 'Basic realm="Bearer"', false ],
            [ 'a challenge on another status', 403, 'Bearer', false ],
        ] )( 'tells whether a 401 is about the access token: %s', async ( _, status, challenge, invalidToken ) => {
            const error = await failWith( json( status, { message: 'Unauthorized' }, challenge ? { 'WWW-Authenticate': challenge } : {} ) );

            expect( error ).toMatchObject( { invalidToken } );
        } );

        it( 'has no field errors, wait or token problem unless given', () => {
            expect( new ApiError( 500, 'Oops' ) ).toMatchObject( { fieldErrors: {}, retryAfterSeconds: undefined, invalidToken: false } );
        } );

        it( 'reads Retry-After on 429', async () => {
            const error = await failWith( json( 429, { message: 'Too many requests; try again later' }, { 'Retry-After': '60' } ) );

            expect( error ).toMatchObject( { status: 429, retryAfterSeconds: 60 } );
        } );

        it( 'falls back to the status text for a body without a message, or that isn\'t JSON', async () => {
            expect( await failWith( json( 404, { message: [ 'not a string' ] } ) ) ).toMatchObject( { status: 404, fieldErrors: {} } );
            expect( await failWith( new Response( '<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' } ) ) )
                .toMatchObject( { status: 502, message: 'Bad Gateway', fieldErrors: {} } );
        } );
    } );
} );
