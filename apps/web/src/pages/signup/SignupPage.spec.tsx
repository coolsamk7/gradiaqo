import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { anonymous, json, loggedIn, mockApi, pending, USER } from '../../test/api.ts';
import { renderApp } from '../../test/render.tsx';

const SIGNED_UP = { 'POST /auth/signup': () => json( 201, { accessToken: 'token', user: USER } ) };

async function openSignupPage( handlers: Parameters<typeof mockApi>[0] = {}, entry: Parameters<typeof renderApp>[0] = '/signup' ) {
    const api = mockApi( { ...anonymous, ...handlers } );

    renderApp( entry );
    await screen.findByRole( 'heading', { name: 'Create your account' } );

    return api;
}

const user = () => userEvent.setup();
const input = ( label: string ) => screen.getByLabelText( label );
const submit = () => user().click( screen.getByRole( 'button', { name: 'Create account' } ) );

interface Details { firstName: string; lastName: string; email: string; password: string }

const SAM: Details = { firstName: 'Sam', lastName: 'Khan', email: 'sam@example.com', password: 'supersecret1' };

async function fill( details: Partial<Details> ) {
    const typing = user();
    const labels = { firstName: 'First name', lastName: 'Last name', email: 'Email', password: 'Password' };

    for ( const [ field, value ] of Object.entries( details ) as [ keyof Details, string ][] ) {
        await typing.clear( input( labels[field] ) );
        if ( value.length > 40 ) {
            // Typing hundreds of characters key by key is slow enough to time out on a busy machine.
            await typing.click( input( labels[field] ) );
            await typing.paste( value );
        } else if ( value ) {
            await typing.type( input( labels[field] ), value );
        }
    }
}

async function fillAndSubmit( details: Partial<Details> = SAM ) {
    await fill( details );
    await submit();
}

describe( 'SignupPage', () => {
    it( 'creates the account with trimmed details, then opens the app', async () => {
        const { calls } = await openSignupPage( SIGNED_UP );

        await fillAndSubmit( { firstName: ' Sam ', lastName: ' Khan ', email: ' sam@example.com ', password: ' supersecret1 ' } );

        expect( await screen.findByRole( 'heading', { name: /, Sam$/ } ) ).toBeInTheDocument();
        expect( screen.getByTestId( 'location' ) ).toHaveTextContent( '/app' );
        // The password is sent exactly as typed: spaces can be part of it.
        expect( calls.find( ( call ) => call.path === '/auth/signup' )?.body ).toEqual( {
            firstName: 'Sam', lastName: 'Khan', email: 'sam@example.com', password: ' supersecret1 ',
        } );
    } );

    it( 'goes back to the page that asked for a login', async () => {
        await openSignupPage( SIGNED_UP, { pathname: '/signup', state: { from: '/somewhere' } } );

        await fillAndSubmit();

        await waitFor( () => expect( screen.getByTestId( 'location' ) ).toHaveTextContent( '/somewhere' ) );
    } );

    it( 'checks every field before calling the API, and focuses the first problem', async () => {
        const { calls } = await openSignupPage();

        await submit();

        expect( input( 'First name' ) ).toHaveAccessibleDescription( 'Enter your first name.' );
        expect( input( 'Last name' ) ).toHaveAccessibleDescription( 'Enter your last name.' );
        expect( input( 'Email' ) ).toHaveAccessibleDescription( 'Enter your email.' );
        expect( input( 'Password' ) ).toHaveAccessibleDescription( 'At least 8 characters. Create a password.' );
        expect( input( 'First name' ) ).toHaveAttribute( 'aria-invalid', 'true' );
        expect( input( 'First name' ) ).toHaveFocus();
        expect( calls.filter( ( call ) => call.path === '/auth/signup' ) ).toHaveLength( 0 );
    } );

    it.each( [
        [ 'a blank first name', { firstName: '   ' }, 'First name', 'Enter your first name.' ],
        [ 'a long first name', { firstName: 'a'.repeat( 101 ) }, 'First name', 'First name must be 100 characters or fewer.' ],
        [ 'a long last name', { lastName: 'a'.repeat( 101 ) }, 'Last name', 'Last name must be 100 characters or fewer.' ],
        [ 'an obviously wrong email', { email: 'sam@example' }, 'Email', 'Enter a valid email, like name@example.com.' ],
        [ 'a long email', { email: `${'a'.repeat( 244 )}@example.com` }, 'Email', 'Email must be 255 characters or fewer.' ],
        [ 'a short password', { password: 'short12' }, 'Password', 'Use at least 8 characters.' ],
        [ 'a long password', { password: 'a'.repeat( 129 ) }, 'Password', 'Use 128 characters or fewer.' ],
    ] )( 'catches %s, and focuses it', async ( _, change, label, message ) => {
        const { calls } = await openSignupPage();

        await fillAndSubmit( { ...SAM, ...change } );

        expect( screen.getByText( message ) ).toBeInTheDocument();
        expect( input( label ) ).toHaveFocus();
        expect( input( label ) ).toHaveAttribute( 'aria-invalid', 'true' );
        expect( calls.filter( ( call ) => call.path === '/auth/signup' ) ).toHaveLength( 0 );
    } );

    it( 'accepts names and a password right at the limits', async () => {
        const { calls } = await openSignupPage( SIGNED_UP );

        await fillAndSubmit( {
            firstName: 'a'.repeat( 100 ), lastName: 'b'.repeat( 100 ), email: `${'a'.repeat( 243 )}@example.com`, password: 'x'.repeat( 8 ),
        } );
        await screen.findByRole( 'heading', { name: /, Sam$/ } );

        expect( calls.filter( ( call ) => call.path === '/auth/signup' ) ).toHaveLength( 1 );
    } );

    it( 'accepts a password of exactly 128 characters', async () => {
        await openSignupPage( SIGNED_UP );

        await fillAndSubmit( { ...SAM, password: 'x'.repeat( 128 ) } );

        expect( await screen.findByRole( 'heading', { name: /, Sam$/ } ) ).toBeInTheDocument();
    } );

    it( 'says that an email is taken, and offers to log in with it', async () => {
        await openSignupPage( { 'POST /auth/signup': () => json( 409, { message: 'Email is already registered' } ) } );

        await fillAndSubmit( { ...SAM, email: ' sam@example.com ' } );

        await screen.findByText( 'An account with this email already exists.', { exact: false } );
        expect( input( 'Email' ) ).toHaveAccessibleDescription( 'An account with this email already exists. Log in instead' );
        expect( input( 'Email' ) ).toHaveAttribute( 'aria-describedby', 'email-error' );
        expect( input( 'Email' ) ).toHaveFocus();
        expect( input( 'Email' ) ).toHaveAttribute( 'aria-invalid', 'true' );
        expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();

        await user().click( screen.getByRole( 'link', { name: 'Log in instead' } ) );

        expect( await screen.findByRole( 'heading', { name: 'Log in' } ) ).toBeInTheDocument();
        expect( input( 'Email' ) ).toHaveValue( 'sam@example.com' );
    } );

    it( 'shows that it is creating the account, and blocks a second submit', async () => {
        await openSignupPage( { 'POST /auth/signup': () => pending() } );

        await fillAndSubmit();

        expect( screen.getByRole( 'button', { name: 'Creating your account…' } ) ).toBeDisabled();
    } );

    it.each( [
        [ 'too many signups, in minutes', () => json( 429, { message: 'Too many requests' }, { 'Retry-After': '1800' } ), 'Too many attempts. Try again in 30 minutes.' ],
        [ 'a server error', () => json( 500, { message: 'Internal server error' } ), 'Something went wrong. Please try again.' ],
        [ 'no connection', () => Promise.reject( new TypeError( 'offline' ) ), 'Can\'t reach Gradiaqo right now. Check your connection and try again.' ],
    ] )( 'explains %s, and lets the user try again', async ( _, handler, message ) => {
        await openSignupPage( { 'POST /auth/signup': handler } );

        await fillAndSubmit();

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( message );
        expect( screen.getByRole( 'button', { name: 'Create account' } ) ).toBeEnabled();
    } );

    it( 'shows the API\'s validation errors on their fields', async () => {
        await openSignupPage( {
            'POST /auth/signup': () => json( 400, {
                message: 'Validation failed (body)',
                errors: [
                    { path: '/firstName', message: 'is odd' },
                    { path: '/lastName', message: 'must be between 1 and 100 characters' },
                    { path: '/password', message: 'is too weak' },
                ],
            } ),
        } );

        await fillAndSubmit();

        expect( await screen.findByText( 'First name is odd.' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Last name must be between 1 and 100 characters.' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Password is too weak.' ) ).toBeInTheDocument();
        expect( input( 'First name' ) ).toHaveFocus();
        expect( input( 'Email' ) ).not.toHaveAttribute( 'aria-invalid' );
    } );

    it( 'clears old errors while it sends the fixed details', async () => {
        await openSignupPage( { 'POST /auth/signup': () => pending() } );

        await fillAndSubmit( { ...SAM, password: 'short' } );
        expect( screen.getByText( 'Use at least 8 characters.' ) ).toBeInTheDocument();

        await fillAndSubmit( { password: 'supersecret1' } );

        expect( screen.queryByText( 'Use at least 8 characters.' ) ).not.toBeInTheDocument();
        expect( input( 'Password' ) ).toHaveAttribute( 'aria-describedby', 'password-hint' );
    } );

    it( 'shows what Gradiaqo offers next to the form (on wide screens)', async () => {
        await openSignupPage();

        expect( screen.getAllByRole( 'listitem', { hidden: true } ).map( ( item ) => item.textContent ) ).toEqual( [
            'Learning paths built from topics and modules', 'Progress tracked as you go', 'Study sessions, streaks and weekly totals',
        ] );
    } );

    it( 'helps password managers and autofill', async () => {
        await openSignupPage();

        expect( input( 'First name' ) ).toHaveAttribute( 'autocomplete', 'given-name' );
        expect( input( 'Last name' ) ).toHaveAttribute( 'autocomplete', 'family-name' );
        expect( input( 'Email' ) ).toHaveAttribute( 'autocomplete', 'email' );
        expect( input( 'Email' ) ).toHaveAttribute( 'type', 'email' );
        expect( input( 'Password' ) ).toHaveAttribute( 'autocomplete', 'new-password' );
        expect( input( 'Password' ) ).toHaveAccessibleDescription( 'At least 8 characters.' );
    } );

    it( 'can show and hide the password', async () => {
        await openSignupPage();

        await user().click( screen.getByRole( 'button', { name: 'Show password' } ) );
        expect( input( 'Password' ) ).toHaveAttribute( 'type', 'text' );
        expect( screen.getByRole( 'button', { name: 'Hide password' } ) ).toHaveTextContent( 'Hide' );
        await user().click( screen.getByRole( 'button', { name: 'Hide password' } ) );
        expect( input( 'Password' ) ).toHaveAttribute( 'type', 'password' );
        expect( screen.getByRole( 'button', { name: 'Show password' } ) ).toHaveTextContent( 'Show' );
    } );

    it( 'sends logged-in users straight to the app', async () => {
        mockApi( loggedIn );

        renderApp( '/signup' );

        expect( await screen.findByRole( 'heading', { name: /, Sam$/ } ) ).toBeInTheDocument();
    } );

    it( 'links to logging in and back, keeping where to go next', async () => {
        await openSignupPage( SIGNED_UP, { pathname: '/signup', state: { from: '/somewhere' } } );

        expect( screen.getByRole( 'link', { name: 'Gradiaqo home' } ) ).toHaveAttribute( 'href', '/' );
        expect( screen.getByText( /^Already have an account\?/ ) ).toHaveTextContent( /^Already have an account\? Log in$/ );

        await user().click( screen.getByRole( 'link', { name: 'Log in' } ) );
        await screen.findByRole( 'heading', { name: 'Log in' } );
        await user().click( screen.getByRole( 'link', { name: 'Create an account' } ) );
        await screen.findByRole( 'heading', { name: 'Create your account' } );
        await fillAndSubmit();

        await waitFor( () => expect( screen.getByTestId( 'location' ) ).toHaveTextContent( '/somewhere' ) );
    } );
} );
