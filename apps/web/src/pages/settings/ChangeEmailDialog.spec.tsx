import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, loggedIn, mockApi, noContent, pending, USER } from '../../test/api.ts';
import { renderApp } from '../../test/render.tsx';

type Handlers = Parameters<typeof mockApi>[0];

function api( handlers: Handlers = {} ) {
    return mockApi( {
        ...loggedIn,
        'POST /auth/change-email': () => noContent(),
        'POST /auth/change-email/confirm': () => json( 200, { ...USER, email: 'new@example.com' } ),
        ...handlers,
    } );
}

const error = ( status: number, message: string, errors?: unknown[] ) =>
    () => json( status, { statusCode: status, message, errors } );

/** Lets the countdown tick: one second, and its re-render, at a time. */
async function seconds( count: number ) {
    for ( let n = 0; n < count; n += 1 ) {
        await act( () => vi.advanceTimersByTimeAsync( 1000 ) );
    }
}

async function openDialog( user: ReturnType<typeof userEvent.setup> ) {
    renderApp( '/app/settings' );
    await user.click( await screen.findByRole( 'button', { name: 'Change email' } ) );

    return screen.getByRole( 'dialog', { name: 'Change your email' } );
}

/** Fills in the first step and sends the code. */
async function requestCode( user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement ) {
    await user.type( within( dialog ).getByLabelText( 'New email' ), ' New@Example.com ' );
    await user.type( within( dialog ).getByLabelText( 'Password' ), 'supersecret1' );
    await user.click( within( dialog ).getByRole( 'button', { name: 'Send code' } ) );
}

describe( 'Changing the email', () => {
    it( 'checks the address and password, and says what the API refused', async () => {
        let answer = error( 401, 'Wrong password' );

        api( { 'POST /auth/change-email': () => answer() } );
        const user = userEvent.setup();
        const dialog = await openDialog( user );
        const email = within( dialog ).getByLabelText( 'New email' );

        expect( email ).toHaveFocus();
        expect( dialog ).toHaveAccessibleDescription( 'You\'ll log in with the new address. We check it first with a code.' );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Send code' } ) );
        expect( email ).toHaveAccessibleDescription( 'Enter a valid email address.' );
        expect( email ).toHaveFocus();
        expect( within( dialog ).getByLabelText( 'Password' ) ).toHaveAccessibleDescription( /Enter your password\.$/ );

        await user.type( email, 'new@example.com' );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Send code' } ) );
        expect( within( dialog ).getByLabelText( 'Password' ) ).toHaveFocus();

        await user.type( within( dialog ).getByLabelText( 'Password' ), 'wrong' );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Send code' } ) );
        expect( await within( dialog ).findByText( 'That isn\'t your password.' ) ).toBeInTheDocument();

        answer = error( 409, 'That email is already used by another account' );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Send code' } ) );
        expect( await within( dialog ).findByText( 'That email is already used by another account.' ) ).toBeInTheDocument();

        answer = error( 400, 'That\'s already your email' );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Send code' } ) );
        expect( await within( dialog ).findByText( 'That\'s already your email.' ) ).toBeInTheDocument();

        answer = error( 400, 'Bad Request', [ { path: '/newEmail', message: 'must be a valid email address' } ] );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Send code' } ) );
        await waitFor( () => expect( email ).toHaveAccessibleDescription( 'Enter a valid email address.' ) );

        answer = error( 503, 'We couldn\'t send the email. Please try again in a minute.' );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Send code' } ) );
        expect( await within( dialog ).findByRole( 'alert' ) ).toHaveTextContent( 'We couldn\'t send the email.' );
        expect( within( dialog ).getByRole( 'button', { name: 'Send code' } ) ).toBeInTheDocument();
    } );

    it( 'sends a code to the new address, then switches to it with the code', async () => {
        let answer = error( 400, 'That code is wrong or has expired. Check the latest email, or ask for a new one.' );
        const { calls } = api( { 'POST /auth/change-email/confirm': () => answer() } );
        const user = userEvent.setup();
        const dialog = await openDialog( user );

        await requestCode( user, dialog );

        expect( await within( dialog ).findByRole( 'status' ) )
            .toHaveTextContent( 'We sent a 6-digit code to new@example.com. It expires in 15 minutes.' );
        expect( calls.find( ( call ) => call.path === '/auth/change-email' )?.body )
            .toEqual( { newEmail: 'new@example.com', password: 'supersecret1' } );
        expect( within( dialog ).getByLabelText( 'New email' ) ).toBeDisabled();
        expect( within( dialog ).getByLabelText( 'New email' ) ).toHaveValue( 'new@example.com' );
        const code = within( dialog ).getByLabelText( 'Code' );

        expect( code ).toHaveFocus();
        await user.click( within( dialog ).getByRole( 'button', { name: 'Confirm new email' } ) );
        expect( code ).toHaveAccessibleDescription( /Enter the 6-digit code from the email\.$/ );

        await user.type( code, '482 913' );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Confirm new email' } ) );
        await waitFor( () => expect( code ).toHaveAccessibleDescription( /That code is wrong or has expired/ ) );

        answer = error( 409, 'That email is already used by another account' );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Confirm new email' } ) );
        expect( await within( dialog ).findByRole( 'alert' ) )
            .toHaveTextContent( 'That email is already used by another account. Choose another address.' );

        answer = () => json( 500, {} );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Confirm new email' } ) );
        await waitFor( () => expect( within( dialog ).getByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong. Please try again.' ) );

        answer = () => json( 200, { ...USER, email: 'new@example.com' } );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Confirm new email' } ) );

        await waitFor( () => expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument() );
        expect( screen.getByRole( 'status' ) ).toHaveTextContent( 'Email changed. Log in with new@example.com from now on.' );
        expect( screen.getByLabelText( 'Email' ) ).toHaveValue( 'new@example.com' );
        expect( calls.filter( ( call ) => call.path === '/auth/change-email/confirm' ).at( -1 )?.body ).toEqual( { code: '482913' } );
        // The sidebar too.
        expect( screen.getByText( 'new@example.com', { selector: 'p, span' } ) ).toBeInTheDocument();
    } );

    it( 'waits while sending and confirming', async () => {
        api( { 'POST /auth/change-email/confirm': pending } );
        const user = userEvent.setup();
        const dialog = await openDialog( user );

        await requestCode( user, dialog );
        await user.type( await within( dialog ).findByLabelText( 'Code' ), '482913' );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Confirm new email' } ) );

        expect( within( dialog ).getByRole( 'button', { name: 'Confirming…' } ) ).toBeDisabled();
    } );

    it( 'sends a new code after a minute, and goes back a step if the address no longer works', async () => {
        vi.useFakeTimers( { shouldAdvanceTime: true } );
        try {
            let answer = () => noContent();
            const { calls } = api( { 'POST /auth/change-email': () => answer() } );
            const user = userEvent.setup( { advanceTimers: vi.advanceTimersByTime } );
            const dialog = await openDialog( user );

            await requestCode( user, dialog );
            const code = await within( dialog ).findByLabelText( 'Code' );

            expect( code ).toHaveAccessibleDescription( 'Didn\'t get it? Resend code in 1:00' );
            await seconds( 18 );
            expect( code ).toHaveAccessibleDescription( 'Didn\'t get it? Resend code in 0:42' );
            await seconds( 42 );
            await user.type( code, '1' );
            await user.click( within( dialog ).getByRole( 'button', { name: 'Resend code' } ) );

            await waitFor( () => expect( code ).toHaveAccessibleDescription( 'Didn\'t get it? Resend code in 1:00' ) );
            expect( code ).toHaveValue( '' );
            expect( calls.filter( ( call ) => call.path === '/auth/change-email' ) ).toHaveLength( 2 );

            await seconds( 60 );
            answer = error( 429, 'We just sent a code. Wait a minute before asking for another.' );
            await user.click( within( dialog ).getByRole( 'button', { name: 'Resend code' } ) );
            expect( await within( dialog ).findByRole( 'alert' ) ).toHaveTextContent( 'Wait a minute before asking for another.' );
            expect( within( dialog ).getByLabelText( 'Code' ) ).toBeInTheDocument();

            answer = error( 409, 'That email is already used by another account' );
            await user.click( within( dialog ).getByRole( 'button', { name: 'Resend code' } ) );
            expect( await within( dialog ).findByText( 'That email is already used by another account.' ) ).toBeInTheDocument();
            expect( within( dialog ).getByLabelText( 'New email' ) ).toHaveValue( 'New@Example.com' );
            expect( within( dialog ).getByRole( 'button', { name: 'Send code' } ) ).toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    } );

    it( 'closes without changing anything', async () => {
        const { calls } = api();
        const user = userEvent.setup();
        const dialog = await openDialog( user );

        await user.click( within( dialog ).getByRole( 'button', { name: 'Cancel' } ) );
        expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();

        await user.click( screen.getByRole( 'button', { name: 'Change email' } ) );
        await requestCode( user, screen.getByRole( 'dialog' ) );
        await user.click( await screen.findByRole( 'button', { name: 'Cancel' } ) );

        expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
        expect( screen.getByLabelText( 'Email' ) ).toHaveValue( 'sam@example.com' );
        expect( calls.some( ( call ) => call.path === '/auth/change-email/confirm' ) ).toBe( false );
    } );

    it( 'opens from Verify email\'s "Use a different email"', async () => {
        api( { 'GET /auth/me': () => json( 200, { ...USER, emailVerifiedAt: null } ) } );
        const user = userEvent.setup();

        renderApp( '/verify-email' );
        await user.click( await screen.findByRole( 'link', { name: 'Use a different email' } ) );

        expect( screen.getByTestId( 'location' ) ).toHaveTextContent( '/app/settings' );
        expect( await screen.findByRole( 'dialog', { name: 'Change your email' } ) ).toBeInTheDocument();
    } );
} );
