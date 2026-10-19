import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { LoginPage } from '../pages/login/LoginPage.tsx';
import { anonymous, expiredToken, json, loggedIn, mockApi, noContent, USER } from '../test/api.ts';
import { renderApp } from '../test/render.tsx';
import { useAuth } from './auth-context.ts';
import { REFRESH_RETRY_DELAY_MS } from './authed-request.ts';
import { AuthProvider } from './AuthProvider.tsx';
import { RequireAuth } from './RequireAuth.tsx';

const SIGNUP = { firstName: 'Sam', lastName: 'Khan', email: 'sam@example.com', password: 'supersecret1' };

/** Shows the auth state, with buttons to log in and out. */
function AuthProbe() {
    const { state, logIn, signUp, logOut, request } = useAuth();
    const [ settled, setSettled ] = useState( 0 );

    return (
        <>
            <output>{state.status === 'authenticated' ? `${state.status}:${state.session.user.firstName}:${state.session.accessToken}` : `${state.status}${state.status === 'anonymous' && state.expired ? ':expired' : ''}`}</output>
            <button type="button" onClick={() => void logIn( 'sam@example.com', 'secret' ).catch( () => undefined )}>log in</button>
            <button type="button" onClick={() => void signUp( SIGNUP ).catch( () => undefined )}>sign up</button>
            <button type="button" onClick={() => void logOut()}>log out</button>
            <button
                type="button"
                onClick={() => void request( '/things' ).catch( () => undefined ).finally( () => setSettled( ( count ) => count + 1 ) )}
            >
                request
            </button>
            <p>{`settled requests: ${settled}`}</p>
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

    it( 'signs up, and stays anonymous when that fails', async () => {
        let status = 409;
        const { calls } = mockApi( {
            ...anonymous,
            'POST /auth/signup': () => ( status === 201 ? json( 201, { accessToken: 'signup-token', user: USER } ) : json( status, {} ) ),
        } );

        renderProvider();
        await screen.findByText( 'anonymous' );

        screen.getByRole( 'button', { name: 'sign up' } ).click();
        await waitFor( () => expect( calls.filter( ( call ) => call.path === '/auth/signup' ) ).toHaveLength( 1 ) );
        expect( screen.getByRole( 'status' ) ).toHaveTextContent( 'anonymous' );

        status = 201;
        screen.getByRole( 'button', { name: 'sign up' } ).click();
        expect( await screen.findByText( 'authenticated:Sam:signup-token' ) ).toBeInTheDocument();
        expect( calls.at( -1 )?.body ).toEqual( SIGNUP );
    } );

    it( 'logs out through the API when it answers', async () => {
        const { calls } = mockApi( { ...loggedIn, 'POST /auth/logout': () => noContent() } );

        renderProvider();
        await screen.findByText( /^authenticated/ );
        screen.getByRole( 'button', { name: 'log out' } ).click();

        expect( await screen.findByText( 'anonymous' ) ).toBeInTheDocument();
        expect( calls.at( -1 ) ).toMatchObject( { method: 'POST', path: '/auth/logout', credentials: 'include' } );
    } );

    it( 'makes requests with the session\'s token, renewing it when it expires', async () => {
        const refreshes = [ 'restored-token', 'renewed' ];
        const { calls } = mockApi( {
            ...loggedIn,
            'POST /auth/refresh': () => json( 200, { accessToken: refreshes.shift() } ),
            'GET /things': ( init ) => ( ( init.headers as Record<string, string> ).Authorization === 'Bearer renewed' ? json( 200, [] ) : expiredToken() ),
        } );

        renderProvider();
        await screen.findByText( 'authenticated:Sam:restored-token' );
        screen.getByRole( 'button', { name: 'request' } ).click();

        expect( await screen.findByText( 'authenticated:Sam:renewed' ) ).toBeInTheDocument();
        await waitFor( () => expect( calls.filter( ( call ) => call.path === '/things' ).map( ( call ) => call.headers.Authorization ) )
            .toEqual( [ 'Bearer restored-token', 'Bearer renewed' ] ) );
    } );

    it( 'ends the session when it can\'t be renewed, and sends no token after logging out', async () => {
        vi.useFakeTimers( { shouldAdvanceTime: true } );
        const refreshes = [ json( 200, { accessToken: 'restored-token' } ) ];
        const { calls } = mockApi( {
            ...loggedIn,
            'POST /auth/refresh': () => refreshes.shift() ?? json( 401, { message: 'Unauthorized' } ),
            'GET /things': () => expiredToken(),
        } );

        renderProvider();
        await screen.findByText( /^authenticated/ );
        screen.getByRole( 'button', { name: 'request' } ).click();
        await vi.advanceTimersByTimeAsync( REFRESH_RETRY_DELAY_MS );

        expect( await screen.findByText( 'anonymous:expired' ) ).toBeInTheDocument();
        expect( calls.filter( ( call ) => call.path === '/auth/refresh' ) ).toHaveLength( 3 );
        vi.useRealTimers();
    } );

    it.each( [
        [ 'succeeds', () => json( 200, { accessToken: 'late' } ) ],
        [ 'fails', () => json( 500, { message: 'Internal server error' } ) ],
    ] )( 'stays logged out when a renewal started before logging out %s', async ( _, answer ) => {
        vi.useFakeTimers( { shouldAdvanceTime: true } );
        let answerRefresh: ( () => void ) | undefined;
        const refreshes = [ json( 200, { accessToken: 'restored-token' } ) ];

        mockApi( {
            ...loggedIn,
            'POST /auth/refresh': () => refreshes.shift() ?? new Promise( ( resolve ) => {
                answerRefresh = () => resolve( answer() );
            } ),
            'POST /auth/logout': () => noContent(),
            'GET /things': () => expiredToken(),
        } );

        renderProvider();
        await screen.findByText( /^authenticated/ );
        screen.getByRole( 'button', { name: 'request' } ).click();
        await waitFor( () => expect( answerRefresh ).toBeDefined() );
        screen.getByRole( 'button', { name: 'log out' } ).click();
        await screen.findByText( 'anonymous' );

        answerRefresh?.();
        await vi.advanceTimersByTimeAsync( REFRESH_RETRY_DELAY_MS );
        await screen.findByText( 'settled requests: 1' );

        expect( screen.getByRole( 'status' ) ).toHaveTextContent( /^anonymous$/ );
        vi.useRealTimers();
    } );

    it( 'forgets the token when logging out', async () => {
        const { calls } = mockApi( {
            ...loggedIn,
            'POST /auth/logout': () => noContent(),
            'GET /things': ( init ) => json( 200, init.headers ),
        } );

        renderProvider();
        await screen.findByText( /^authenticated/ );
        screen.getByRole( 'button', { name: 'log out' } ).click();
        await screen.findByText( 'anonymous' );
        screen.getByRole( 'button', { name: 'request' } ).click();

        await waitFor( () => expect( calls.at( -1 )?.path ).toBe( '/things' ) );
        expect( calls.at( -1 )?.headers ).toEqual( {} );
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

    it( 'sends users whose session ends to the login page, which says so and brings them back', async () => {
        vi.useFakeTimers( { shouldAdvanceTime: true } );
        const refreshes = [ json( 200, { accessToken: 'restored-token' } ) ];

        mockApi( {
            ...loggedIn,
            'POST /auth/refresh': () => refreshes.shift() ?? json( 401, { message: 'Unauthorized' } ),
            'GET /things': () => expiredToken(),
            'POST /auth/login': () => json( 200, { accessToken: 'token', user: USER } ),
        } );

        function Protected() {
            const { request } = useAuth();

            return <button type="button" onClick={() => void request( '/things' ).catch( () => undefined )}>load</button>;
        }

        render(
            <MemoryRouter initialEntries={[ '/private' ]}>
                <AuthProvider>
                    <Routes>
                        <Route path="/private" element={<RequireAuth><Protected /></RequireAuth>} />
                        <Route path="/login" element={<LoginPage />} />
                    </Routes>
                </AuthProvider>
            </MemoryRouter>,
        );
        ( await screen.findByRole( 'button', { name: 'load' } ) ).click();
        await vi.advanceTimersByTimeAsync( REFRESH_RETRY_DELAY_MS );

        expect( await screen.findByRole( 'heading', { name: 'Log in' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'status' ) ).toHaveTextContent( 'Your session has ended. Log in again to continue.' );
        vi.useRealTimers();

        await userEvent.type( screen.getByLabelText( 'Email' ), 'sam@example.com' );
        await userEvent.type( screen.getByLabelText( 'Password' ), 'supersecret1' );
        await userEvent.click( screen.getByRole( 'button', { name: 'Log in' } ) );

        expect( await screen.findByRole( 'button', { name: 'load' } ) ).toBeInTheDocument();
    } );

    it( 'shows the page to logged-in users', async () => {
        mockApi( loggedIn );

        renderApp( '/app' );

        expect( await screen.findByRole( 'heading', { name: /, Sam$/ } ) ).toBeInTheDocument();
    } );
} );
