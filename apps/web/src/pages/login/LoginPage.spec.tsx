import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { anonymous, json, loggedIn, mockApi, pending, USER } from '../../test/api.ts';
import { renderApp } from '../../test/render.tsx';

const LOGGED_IN = { 'POST /auth/login': () => json( 200, { accessToken: 'token', user: USER } ) };

async function openLoginPage( handlers: Parameters<typeof mockApi>[0] = {}, entry: Parameters<typeof renderApp>[0] = '/login' ) {
    const api = mockApi( { ...anonymous, ...handlers } );

    renderApp( entry );
    await screen.findByRole( 'heading', { name: 'Log in' } );

    return api;
}

const user = () => userEvent.setup();
const emailInput = () => screen.getByLabelText( 'Email' );
const passwordInput = () => screen.getByLabelText( 'Password' );

async function fillAndSubmit( email: string, password: string ) {
    const typing = user();

    if ( email ) {
        await typing.type( emailInput(), email );
    }
    if ( password ) {
        await typing.type( passwordInput(), password );
    }
    await typing.click( screen.getByRole( 'button', { name: 'Log in' } ) );
}

describe( 'LoginPage', () => {
    it( 'logs in with the trimmed email, then opens the app', async () => {
        const { calls } = await openLoginPage( LOGGED_IN );

        await fillAndSubmit( '  sam@example.com ', 'supersecret1' );

        expect( await screen.findByRole( 'heading', { name: 'Welcome back, Sam!' } ) ).toBeInTheDocument();
        expect( screen.getByTestId( 'location' ) ).toHaveTextContent( '/app' );
        expect( calls.find( ( call ) => call.path === '/auth/login' )?.body ).toEqual( { email: 'sam@example.com', password: 'supersecret1' } );
    } );

    it( 'goes back to the page that asked for a login', async () => {
        await openLoginPage( LOGGED_IN, { pathname: '/login', state: { from: '/somewhere' } } );

        await fillAndSubmit( 'sam@example.com', 'supersecret1' );

        await waitFor( () => expect( screen.getByTestId( 'location' ) ).toHaveTextContent( '/somewhere' ) );
    } );

    it( 'checks the fields before calling the API, and focuses the first problem', async () => {
        const { calls } = await openLoginPage();

        await fillAndSubmit( '', '' );

        expect( screen.getByText( 'Enter your email.' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Enter your password.' ) ).toBeInTheDocument();
        expect( emailInput() ).toHaveAttribute( 'aria-invalid', 'true' );
        expect( emailInput() ).toHaveAccessibleDescription( 'Enter your email.' );
        expect( passwordInput() ).toHaveAccessibleDescription( 'Enter your password.' );
        expect( emailInput() ).toHaveFocus();
        expect( calls.filter( ( call ) => call.path === '/auth/login' ) ).toHaveLength( 0 );
    } );

    it( 'catches an obviously wrong email, and only flags the password when it is missing', async () => {
        await openLoginPage();

        await fillAndSubmit( 'sam@example', '' );

        expect( screen.getByText( 'Enter a valid email, like name@example.com.' ) ).toBeInTheDocument();

        await user().type( passwordInput(), 'x' );
        await user().clear( emailInput() );
        await user().type( emailInput(), 'sam@example.com' );
        await user().click( screen.getByRole( 'button', { name: 'Log in' } ) );

        expect( screen.queryByText( 'Enter your password.' ) ).not.toBeInTheDocument();
    } );

    it( 'focuses the password when only it is missing', async () => {
        await openLoginPage();

        await fillAndSubmit( 'sam@example.com', '' );

        expect( passwordInput() ).toHaveFocus();
        expect( emailInput() ).not.toHaveAttribute( 'aria-invalid' );
    } );

    it( 'shows that it is logging in, and blocks a second submit', async () => {
        await openLoginPage( { 'POST /auth/login': () => pending() } );

        await fillAndSubmit( 'sam@example.com', 'supersecret1' );

        expect( screen.getByRole( 'button', { name: 'Logging in…' } ) ).toBeDisabled();
    } );

    it.each( [
        [ 'a wrong email or password', () => json( 401, { message: 'Invalid email or password' } ), 'That email and password don\'t match. Check them and try again.' ],
        [ 'too many attempts, with the wait', () => json( 429, { message: 'Too many requests' }, { 'Retry-After': '42' } ), 'Too many attempts. Try again in 42 seconds.' ],
        [ 'too many attempts, without a wait', () => json( 429, { message: 'Too many requests' } ), 'Too many attempts. Wait a minute and try again.' ],
        [ 'a validation error on no known field', () => json( 400, { message: 'Validation failed (body)', errors: [ { path: '/other', message: 'is odd' } ] } ), 'Check your details and try again.' ],
        [ 'a server error', () => json( 500, { message: 'Internal server error' } ), 'Something went wrong. Please try again.' ],
        [ 'no connection', () => Promise.reject( new TypeError( 'offline' ) ), 'Can\'t reach StudyLog right now. Check your connection and try again.' ],
    ] )( 'explains %s, and lets the user try again', async ( _, handler, message ) => {
        await openLoginPage( { 'POST /auth/login': handler } );

        await fillAndSubmit( 'sam@example.com', 'supersecret1' );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( message );
        expect( screen.getByRole( 'button', { name: 'Log in' } ) ).toBeEnabled();
    } );

    it( 'shows the API\'s validation errors on their fields', async () => {
        await openLoginPage( {
            'POST /auth/login': () => json( 400, {
                message: 'Validation failed (body)',
                errors: [ { path: '/email', message: 'must be a valid email address' }, { path: '/password', message: 'is too long' } ],
            } ),
        } );

        await fillAndSubmit( 'sam@example.com', 'supersecret1' );

        expect( await screen.findByText( 'Email must be a valid email address.' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Password is too long.' ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();
        expect( emailInput() ).toHaveFocus();
    } );

    it( 'can show and hide the password', async () => {
        await openLoginPage();
        const toggle = screen.getByRole( 'button', { name: 'Show password' } );

        expect( passwordInput() ).toHaveAttribute( 'type', 'password' );
        expect( toggle ).toHaveAttribute( 'aria-pressed', 'false' );
        await user().click( toggle );
        expect( passwordInput() ).toHaveAttribute( 'type', 'text' );
        expect( toggle ).toHaveAccessibleName( 'Hide password' );
        expect( toggle ).toHaveAttribute( 'aria-pressed', 'true' );
        await user().click( toggle );
        expect( passwordInput() ).toHaveAttribute( 'type', 'password' );
    } );

    it( 'sends logged-in users straight to the app', async () => {
        mockApi( loggedIn );

        renderApp( '/login' );

        expect( await screen.findByRole( 'heading', { name: 'Welcome back, Sam!' } ) ).toBeInTheDocument();
    } );

    it( 'clears old errors while it logs in', async () => {
        await openLoginPage( { 'POST /auth/login': () => pending() } );

        await fillAndSubmit( 'sam@example.com', '' );
        await fillAndSubmit( '', 'supersecret1' );

        expect( screen.queryByText( 'Enter your password.' ) ).not.toBeInTheDocument();
        expect( passwordInput() ).not.toHaveAttribute( 'aria-describedby' );
    } );

    it( 'shows what StudyLog offers next to the form (on wide screens)', async () => {
        await openLoginPage();

        expect( screen.getAllByRole( 'listitem', { hidden: true } ).map( ( item ) => item.textContent ) ).toEqual( [
            'Your learning paths, in your order', 'Progress on every topic and module', 'Study sessions, streaks and weekly totals',
        ] );
        expect( screen.getByText( /^New to StudyLog\?/ ) ).toHaveTextContent( /^New to StudyLog\? Create an account$/ );
    } );

    it( 'can start with an email filled in', async () => {
        await openLoginPage( {}, { pathname: '/login', state: { email: 'sam@example.com' } } );

        expect( emailInput() ).toHaveValue( 'sam@example.com' );
    } );

    it( 'links to signing up and back home', async () => {
        await openLoginPage();

        expect( screen.getByRole( 'link', { name: 'Create an account' } ) ).toHaveAttribute( 'href', '/signup' );
        expect( screen.getByRole( 'link', { name: 'StudyLog home' } ) ).toHaveAttribute( 'href', '/' );
    } );
} );
