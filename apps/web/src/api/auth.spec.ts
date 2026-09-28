import { json, mockApi, noContent, USER } from '../test/api.ts';
import { getCurrentUser, login, logout, refreshSession, signup } from './auth.ts';

describe( 'auth API', () => {
    it( 'calls the auth endpoints', async () => {
        const { calls } = mockApi( {
            'POST /auth/login': () => json( 200, { accessToken: 'a', user: USER } ),
            'POST /auth/refresh': () => json( 200, { accessToken: 'b' } ),
            'GET /auth/me': () => json( 200, USER ),
            'POST /auth/logout': () => noContent(),
        } );

        await expect( login( { email: 'sam@example.com', password: 'secret' } ) ).resolves.toEqual( { accessToken: 'a', user: USER } );
        await expect( refreshSession() ).resolves.toEqual( { accessToken: 'b' } );
        await expect( getCurrentUser( 'b' ) ).resolves.toEqual( USER );
        await expect( logout() ).resolves.toBeUndefined();

        expect( calls.map( ( call ) => `${call.method} ${call.path}` ) ).toEqual( [
            'POST /auth/login', 'POST /auth/refresh', 'GET /auth/me', 'POST /auth/logout',
        ] );
        expect( calls[0]?.body ).toEqual( { email: 'sam@example.com', password: 'secret' } );
        expect( calls[2]?.headers ).toEqual( { Authorization: 'Bearer b' } );
    } );

    it( 'signs up', async () => {
        const details = { firstName: 'Sam', lastName: 'Khan', email: 'sam@example.com', password: 'supersecret1' };
        const { calls } = mockApi( { 'POST /auth/signup': () => json( 201, { accessToken: 'a', user: USER } ) } );

        await expect( signup( details ) ).resolves.toEqual( { accessToken: 'a', user: USER } );

        expect( calls ).toMatchObject( [ { method: 'POST', path: '/auth/signup', body: details, credentials: 'include' } ] );
    } );
} );
