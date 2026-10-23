import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { anonymous, json, loggedIn, mockApi, noContent, pending } from '../../test/api.ts';
import { renderApp } from '../../test/render.tsx';
import { firstInvalid, validateReset } from './reset.ts';

type Handlers = Parameters<typeof mockApi>[0];

function api( handlers: Handlers = {} ) {
    return mockApi( {
        ...anonymous,
        'POST /auth/forgot-password': () => noContent(),
        'POST /auth/reset-password': () => noContent(),
        ...handlers,
    } );
}

describe( 'Forgot and reset password', () => {
    it( 'goes from the login page to a code, a new password, and back to logging in', async () => {
        const { calls } = api();
        const user = userEvent.setup();

        renderApp( '/login' );
        await user.type( await screen.findByLabelText( 'Email' ), 'sam@example.com' );
        await user.click( screen.getByRole( 'link', { name: 'Forgot password?' } ) );

        expect( screen.getByRole( 'heading', { level: 1, name: 'Reset your password' } ) ).toBeInTheDocument();
        expect( screen.getByLabelText( 'Email' ) ).toHaveValue( 'sam@example.com' );
        await user.click( screen.getByRole( 'button', { name: 'Send reset code' } ) );

        expect( await screen.findByRole( 'heading', { level: 1, name: 'Choose a new password' } ) ).toBeInTheDocument();
        expect( screen.getByText( 'Enter the code we sent to sam@example.com and your new password.' ) ).toBeInTheDocument();
        expect( screen.queryByLabelText( 'Email' ) ).not.toBeInTheDocument();
        expect( screen.getByText( 'This signs you out on your other devices.' ) ).toBeInTheDocument();

        await user.type( screen.getByLabelText( 'Code' ), '482 913' );
        expect( screen.getByLabelText( 'Code' ) ).toHaveValue( '482913' );
        await user.type( screen.getByLabelText( 'New password' ), 'a-new-password' );
        await user.click( screen.getByRole( 'button', { name: 'Reset password' } ) );

        await waitFor( () => expect( screen.getByTestId( 'location' ) ).toHaveTextContent( '/login' ) );
        expect( screen.getByRole( 'status' ) ).toHaveTextContent( 'Your password was changed. Log in with your new password.' );
        expect( screen.getByLabelText( 'Email' ) ).toHaveValue( 'sam@example.com' );
        expect( calls.find( ( call ) => call.path === '/auth/forgot-password' )?.body ).toEqual( { email: 'sam@example.com' } );
        expect( calls.find( ( call ) => call.path === '/auth/reset-password' )?.body )
            .toEqual( { email: 'sam@example.com', code: '482913', newPassword: 'a-new-password' } );
    } );

    it( 'checks the email before sending, and says when sending failed', async () => {
        let answer = () => json( 500, {} );

        api( { 'POST /auth/forgot-password': () => answer() } );
        const user = userEvent.setup();

        renderApp( '/forgot-password' );
        await user.click( await screen.findByRole( 'button', { name: 'Send reset code' } ) );
        expect( screen.getByText( 'Enter the email you signed up with.' ) ).toBeInTheDocument();
        expect( screen.getByLabelText( 'Email' ) ).toHaveFocus();

        await user.type( screen.getByLabelText( 'Email' ), 'sam@example.com' );
        await user.click( screen.getByRole( 'button', { name: 'Send reset code' } ) );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong. Please try again.' );

        answer = () => new Promise<Response>( () => undefined ) as unknown as Response;
        await user.click( screen.getByRole( 'button', { name: 'Send reset code' } ) );
        expect( await screen.findByRole( 'button', { name: 'Sending…' } ) ).toBeDisabled();
        expect( screen.getByRole( 'link', { name: 'Back to log in' } ) ).toHaveAttribute( 'href', '/login' );
        expect( screen.getByRole( 'link', { name: 'Log in' } ) ).toHaveAttribute( 'href', '/login' );
    } );

    it( 'asks for the email too when opened directly, and checks every field', async () => {
        let answer = () => json( 400, { statusCode: 400, message: 'That code is wrong or has expired. Check the latest email, or ask for a new code.' } );

        api( { 'POST /auth/reset-password': () => answer() } );
        const user = userEvent.setup();

        renderApp( '/reset-password' );
        expect( await screen.findByText( 'Enter your email, the code we sent to it, and your new password.' ) ).toBeInTheDocument();
        expect( screen.getByRole( 'link', { name: 'Back to log in' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'link', { name: 'Send a new one' } ) ).toHaveAttribute( 'href', '/forgot-password' );

        await user.click( screen.getByRole( 'button', { name: 'Reset password' } ) );
        expect( screen.getByText( 'Enter the email you signed up with.' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Enter the 6-digit code from the email.' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Use at least 8 characters.' ) ).toBeInTheDocument();
        expect( screen.getByLabelText( 'Email' ) ).toHaveFocus();

        await user.type( screen.getByLabelText( 'Email' ), 'sam@example.com' );
        await user.type( screen.getByLabelText( 'Code' ), '000000' );
        await user.type( screen.getByLabelText( 'New password' ), 'a-new-password' );
        await user.click( screen.getByRole( 'button', { name: 'Reset password' } ) );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'That code is wrong or has expired.' );

        answer = () => new Promise<Response>( () => undefined ) as unknown as Response;
        await user.click( screen.getByRole( 'button', { name: 'Reset password' } ) );
        expect( await screen.findByRole( 'button', { name: 'Saving…' } ) ).toBeDisabled();
    } );

    it( 'sends a new code from the reset page', async () => {
        let answer = () => noContent();
        const { calls } = api( { 'POST /auth/forgot-password': () => answer() } );
        const user = userEvent.setup();

        renderApp( '/reset-password' );
        await user.type( await screen.findByLabelText( 'Email' ), 'sam@example.com' );
        await user.click( screen.getByRole( 'button', { name: 'Send a new one' } ) );

        expect( await screen.findByRole( 'status' ) ).toHaveTextContent( 'a new code is on its way' );
        expect( calls.find( ( call ) => call.path === '/auth/forgot-password' )?.body ).toEqual( { email: 'sam@example.com' } );

        answer = () => {
            throw new TypeError( 'Failed to fetch' );
        };
        await user.click( screen.getByRole( 'button', { name: 'Send a new one' } ) );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach StudyLog right now.' );
    } );

    it( 'logs out first when resetting while logged in', async () => {
        const { calls } = mockApi( {
            ...loggedIn,
            'POST /auth/reset-password': () => noContent(),
            'POST /auth/logout': () => noContent(),
            'GET /me/stats': pending,
        } );
        const user = userEvent.setup();

        renderApp( '/reset-password' );
        await user.type( await screen.findByLabelText( 'Email' ), 'sam@example.com' );
        await user.type( screen.getByLabelText( 'Code' ), '482913' );
        await user.type( screen.getByLabelText( 'New password' ), 'a-new-password' );
        await user.click( screen.getByRole( 'button', { name: 'Reset password' } ) );

        await waitFor( () => expect( screen.getByRole( 'heading', { level: 1, name: 'Log in' } ) ).toBeInTheDocument() );
        expect( calls.some( ( call ) => call.path === '/auth/logout' ) ).toBe( true );
    } );

    it( 'checks the reset fields', () => {
        expect( validateReset( 'sam@example.com', '482913', 'long-enough' ) ).toEqual( {} );
        expect( firstInvalid( { code: 'x', password: 'x' } ) ).toBe( 'code' );
        expect( firstInvalid( { password: 'x' } ) ).toBe( 'new-password' );
        expect( firstInvalid( {} ) ).toBeUndefined();
    } );
} );
