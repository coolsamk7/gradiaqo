import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, mockApi, noContent, pending, USER } from '../../test/api.ts';
import { renderApp } from '../../test/render.tsx';

const UNVERIFIED = { ...USER, emailVerifiedAt: null };

type Handlers = Parameters<typeof mockApi>[0];

function api( handlers: Handlers = {} ) {
    return mockApi( {
        'POST /auth/refresh': () => json( 200, { accessToken: 'restored-token' } ),
        'GET /auth/me': () => json( 200, UNVERIFIED ),
        'POST /auth/verify-email': () => json( 200, { ...UNVERIFIED, emailVerifiedAt: '2026-10-23T10:00:00.000Z' } ),
        'POST /auth/verify-email/resend': () => noContent(),
        'GET /me/stats': pending,
        'GET /me/enrollments': pending,
        'GET /me/study-sessions': pending,
        'GET /me/study-sessions/options': pending,
        ...handlers,
    } );
}

/** Lets the countdown tick: one second, and its re-render, at a time. */
async function seconds( count: number ) {
    for ( let n = 0; n < count; n += 1 ) {
        await act( () => vi.advanceTimersByTimeAsync( 1000 ) );
    }
}

const digits = () => screen.getByRole( 'group', { name: 'Verification code' } );

describe( 'Verify your email', () => {
    it( 'reminds an unverified user on every page, and links to the code page', async () => {
        api();
        const user = userEvent.setup();

        renderApp( '/app' );

        const banner = await screen.findByText( 'Verify your email: we sent a 6-digit code to sam@example.com.' );

        await user.click( within( banner.parentElement! ).getByRole( 'link', { name: 'Enter code' } ) );
        expect( screen.getByTestId( 'location' ) ).toHaveTextContent( '/verify-email' );
        expect( screen.getByRole( 'heading', { level: 1, name: 'Check your inbox' } ) ).toBeInTheDocument();
        expect( screen.getByText( 'We sent a 6-digit code to sam@example.com. Enter it below to verify your email.' ) ).toBeInTheDocument();
    } );

    it( 'verifies with the code, then goes back to where the user was, without the banner', async () => {
        const { calls } = api();
        const user = userEvent.setup();

        renderApp( '/app/sessions' );
        await user.click( await screen.findByRole( 'link', { name: 'Enter code' } ) );

        expect( within( digits() ).getByRole( 'textbox', { name: 'Digit 1 of 6' } ) ).toHaveFocus();
        await user.keyboard( '482913' );
        await user.click( screen.getByRole( 'button', { name: 'Verify email' } ) );

        await waitFor( () => expect( screen.getByTestId( 'location' ) ).toHaveTextContent( '/app/sessions' ) );
        expect( calls.find( ( call ) => call.path === '/auth/verify-email' )?.body ).toEqual( { code: '482913' } );
        expect( screen.queryByText( /Verify your email/ ) ).not.toBeInTheDocument();
    } );

    it( 'needs all six digits, and says when the code is wrong', async () => {
        let answer = () => json( 400, { statusCode: 400, message: 'That code is wrong or has expired. Check the latest email, or ask for a new code.' } );

        api( { 'POST /auth/verify-email': () => answer() } );
        const user = userEvent.setup();

        renderApp( '/verify-email' );
        await screen.findByRole( 'heading', { name: 'Check your inbox' } );

        await user.keyboard( '482' );
        await user.click( screen.getByRole( 'button', { name: 'Verify email' } ) );
        expect( screen.getByRole( 'alert' ) ).toHaveTextContent( 'Enter all 6 digits of the code.' );

        await user.click( within( digits() ).getByRole( 'textbox', { name: 'Digit 4 of 6' } ) );
        await user.keyboard( '913' );
        await user.click( screen.getByRole( 'button', { name: 'Verify email' } ) );
        expect( await screen.findByText( /That code is wrong or has expired/ ) ).toBeInTheDocument();
        // The boxes are cleared for the next try.
        expect( within( digits() ).getByRole( 'textbox', { name: 'Digit 1 of 6' } ) ).toHaveValue( '' );

        answer = () => new Promise<Response>( () => undefined ) as unknown as Response;
        await user.click( within( digits() ).getByRole( 'textbox', { name: 'Digit 1 of 6' } ) );
        await user.keyboard( '111111' );
        await user.click( screen.getByRole( 'button', { name: 'Verify email' } ) );
        expect( await screen.findByRole( 'button', { name: 'Verifying…' } ) ).toBeDisabled();
    } );

    it( 'sends a new code, then waits a minute before offering another', async () => {
        vi.useFakeTimers( { shouldAdvanceTime: true } );
        try {
            let answer = () => noContent();
            const { calls } = api( { 'POST /auth/verify-email/resend': () => answer() } );
            const user = userEvent.setup( { advanceTimers: vi.advanceTimersByTime } );

            renderApp( '/verify-email' );
            await user.click( await screen.findByRole( 'button', { name: 'Resend code' } ) );

            expect( await screen.findByRole( 'status' ) ).toHaveTextContent( 'We sent a new code to sam@example.com.' );
            expect( screen.getByText( 'Resend code in 1:00' ) ).toBeInTheDocument();
            await seconds( 18 );
            expect( screen.getByText( 'Resend code in 0:42' ) ).toBeInTheDocument();
            await seconds( 42 );

            answer = () => json( 429, { statusCode: 429, message: 'We just sent a code. Wait a minute before asking for another.' } );
            await user.click( screen.getByRole( 'button', { name: 'Resend code' } ) );
            expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Wait a minute before asking for another.' );
            expect( calls.filter( ( call ) => call.path === '/auth/verify-email/resend' ) ).toHaveLength( 2 );
        } finally {
            vi.useRealTimers();
        }
    } );

    it( 'leaves the page right away once verified', async () => {
        mockApi( {
            'POST /auth/refresh': () => json( 200, { accessToken: 'restored-token' } ),
            'GET /auth/me': () => json( 200, USER ),
            'GET /me/stats': pending,
            'GET /me/enrollments': pending,
            'GET /me/study-sessions': pending,
        } );
        renderApp( '/verify-email' );

        await waitFor( () => expect( screen.getByTestId( 'location' ) ).toHaveTextContent( /^\/app$/ ) );
    } );

    it( 'offers a way back without verifying', async () => {
        api();
        renderApp( '/verify-email' );

        expect( await screen.findByRole( 'link', { name: 'Not now' } ) ).toHaveAttribute( 'href', '/app' );
        expect( screen.getByRole( 'link', { name: 'Use a different email' } ) ).toHaveAttribute( 'href', '/app/settings' );
    } );
} );
