import { render, screen } from '@testing-library/react';
import { StrictMode } from 'react';

import { anonymous, json, loggedIn, mockApi, noContent, USER } from '../test/api.ts';
import { renderApp } from '../test/render.tsx';
import { useAuth } from './auth-context.ts';
import { AuthProvider } from './AuthProvider.tsx';

/** Shows the auth state, with buttons to log in and out. */
function AuthProbe() {
    const { state, logIn, logOut } = useAuth();

    return (
        <>
            <output>{state.status === 'authenticated' ? `${state.status}:${state.session.user.firstName}:${state.session.accessToken}` : state.status}</output>
            <button type="button" onClick={() => void logIn( 'sam@example.com', 'secret' ).catch( () => undefined )}>log in</button>
            <button type="button" onClick={() => void logOut()}>log out</button>
        </>
    );
}

const renderProvider = () => render( <StrictMode><AuthProvider><AuthProbe /></AuthProvider></StrictMode> );

describe( 'AuthProvider', () => {
    it( 'restores the session from the refresh cookie at startup, once even in StrictMode', async () => {
        const { calls } = mockApi( loggedIn );

        renderProvider();

        expect( screen.getByRole( 'status' ) ).toHaveTextContent( 'loading' );
        expect( await screen.findByText( 'authenticated:Sam:restored-token' ) ).toBeInTheDocument();
        expect( calls.filter( ( call ) => call.path === '/auth/refresh' ) ).toHaveLength( 1 );
        expect( calls.find( ( call ) => call.path === '/auth/me' )?.headers ).toEqual( { Authorization: 'Bearer restored-token' } );
    } );

    it( 'is anonymous without a valid session', async () => {
        mockApi( anonymous );

        renderProvider();

        expect( await screen.findByText( 'anonymous' ) ).toBeInTheDocument();
    } );

    it( 'logs in, and logs out even when the API can\'t be reached', async () => {
        mockApi( {
            ...anonymous,
            'POST /auth/login': () => json( 200, { accessToken: 'new-token', user: USER } ),
            'POST /auth/logout': () => Promise.reject( new TypeError( 'offline' ) ),
        } );
        renderProvider();
        await screen.findByText( 'anonymous' );

        screen.getByRole( 'button', { name: 'log in' } ).click();
        expect( await screen.findByText( 'authenticated:Sam:new-token' ) ).toBeInTheDocument();

        screen.getByRole( 'button', { name: 'log out' } ).click();
        expect( await screen.findByText( 'anonymous' ) ).toBeInTheDocument();
    } );

    it( 'logs out through the API when it answers', async () => {
        const { calls } = mockApi( { ...loggedIn, 'POST /auth/logout': () => noContent() } );

        renderProvider();
        await screen.findByText( /^authenticated/ );
        screen.getByRole( 'button', { name: 'log out' } ).click();

        expect( await screen.findByText( 'anonymous' ) ).toBeInTheDocument();
        expect( calls.at( -1 ) ).toMatchObject( { method: 'POST', path: '/auth/logout', credentials: 'include' } );
    } );

    it( 'useAuth() explains when it\'s used outside the provider', () => {
        vi.spyOn( console, 'error' ).mockImplementation( () => undefined );

        expect( () => render( <AuthProbe /> ) ).toThrow( 'useAuth() must be used inside <AuthProvider>' );
    } );
} );

describe( 'RequireAuth', () => {
    it( 'shows a loading state while the session is being checked', () => {
        vi.spyOn( globalThis, 'fetch' ).mockReturnValue( new Promise( () => undefined ) );

        renderApp( '/app' );

        expect( screen.getByRole( 'status' ) ).toHaveTextContent( 'Loading…' );
    } );

    it( 'sends anonymous visitors to the login page', async () => {
        mockApi( anonymous );

        renderApp( '/app' );

        expect( await screen.findByRole( 'heading', { name: 'Log in' } ) ).toBeInTheDocument();
        expect( screen.getByTestId( 'location' ) ).toHaveTextContent( '/login' );
    } );

    it( 'shows the page to logged-in users', async () => {
        mockApi( loggedIn );

        renderApp( '/app' );

        expect( await screen.findByRole( 'heading', { name: 'Welcome back, Sam!' } ) ).toBeInTheDocument();
    } );
} );
