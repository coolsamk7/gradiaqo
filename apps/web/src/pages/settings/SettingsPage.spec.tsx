import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApiError, NetworkError } from '../../api/client.ts';
import { json, loggedIn, mockApi, noContent, USER } from '../../test/api.ts';
import { renderApp } from '../../test/render.tsx';
import { isWrongPassword, saveError, validatePassword, validateProfile } from './account-forms.ts';

type Handlers = Parameters<typeof mockApi>[0];

function api( handlers: Handlers = {} ) {
    return mockApi( {
        ...loggedIn,
        'PATCH /auth/me': ( init ) => json( 200, { ...USER, ...JSON.parse( init.body as string ) as object } ),
        'POST /auth/change-password': () => noContent(),
        'POST /auth/delete-account': () => noContent(),
        ...handlers,
    } );
}

const card = ( name: string ) => screen.getByRole( 'region', { name } );

describe( 'SettingsPage', () => {
    it( 'shows the profile, with the email changed only through its dialog', async () => {
        api();
        renderApp( '/app/settings' );

        expect( await screen.findByRole( 'heading', { level: 1, name: 'Settings' } ) ).toBeInTheDocument();
        const profile = card( 'Profile' );

        expect( profile ).toHaveTextContent( 'SKSam KhanMember since Jan 2026' );
        expect( within( profile ).getByLabelText( 'First name' ) ).toHaveValue( 'Sam' );
        expect( within( profile ).getByLabelText( 'Last name' ) ).toHaveValue( 'Khan' );
        expect( within( profile ).getByLabelText( 'Email' ) ).toBeDisabled();
        expect( within( profile ).getByRole( 'button', { name: 'Change email' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'link', { name: 'Settings' } ) ).toHaveAttribute( 'aria-current', 'page' );
    } );

    it( 'saves a new name, and shows it everywhere', async () => {
        const { calls } = api();
        const user = userEvent.setup();

        renderApp( '/app/settings' );
        const first = await screen.findByLabelText( 'First name' );

        await user.clear( first );
        await user.type( first, '  Samira ' );
        await user.click( screen.getByRole( 'button', { name: 'Save changes' } ) );

        expect( await screen.findByRole( 'status' ) ).toHaveTextContent( 'Saved.' );
        expect( calls.find( ( call ) => call.method === 'PATCH' )?.body ).toEqual( { firstName: 'Samira', lastName: 'Khan' } );
        expect( card( 'Profile' ) ).toHaveTextContent( 'Samira Khan' );
        // The sidebar too.
        expect( screen.getAllByText( 'Samira Khan' ) ).toHaveLength( 2 );
    } );

    it( 'needs both names, and shows the API\'s field errors', async () => {
        let answer = () => json( 400, { statusCode: 400, message: 'Bad Request', errors: [ { path: '/lastName', message: 'must be shorter' } ] } );

        api( { 'PATCH /auth/me': () => answer() } );
        const user = userEvent.setup();

        renderApp( '/app/settings' );
        await user.clear( await screen.findByLabelText( 'First name' ) );
        await user.clear( screen.getByLabelText( 'Last name' ) );
        await user.click( screen.getByRole( 'button', { name: 'Save changes' } ) );

        expect( screen.getByText( 'Enter your first name.' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Enter your last name.' ) ).toBeInTheDocument();
        expect( screen.getByLabelText( 'First name' ) ).toHaveFocus();

        await user.type( screen.getByLabelText( 'First name' ), 'Sam' );
        await user.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
        expect( screen.getByLabelText( 'Last name' ) ).toHaveFocus();

        await user.type( screen.getByLabelText( 'Last name' ), 'Khan' );
        await user.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
        expect( await screen.findByText( 'must be shorter' ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();

        answer = () => json( 500, {} );
        await user.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so nothing was saved.' );

        answer = () => {
            throw new TypeError( 'Failed to fetch' );
        };
        await user.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
        await waitFor( () => expect( screen.getByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach StudyLog right now.' ) );

        answer = () => new Promise<Response>( () => undefined ) as unknown as Response;
        await user.click( screen.getByRole( 'button', { name: 'Save changes' } ) );
        expect( await screen.findByRole( 'button', { name: 'Saving…' } ) ).toBeDisabled();
    } );

    it( 'changes the password, then clears the fields', async () => {
        const { calls } = api();
        const user = userEvent.setup();

        renderApp( '/app/settings' );
        const password = await screen.findByRole( 'region', { name: 'Password' } );

        expect( password ).toHaveTextContent( 'Changing your password signs you out on your other devices.' );
        await user.type( within( password ).getByLabelText( 'Current password' ), 'old-password' );
        await user.type( within( password ).getByLabelText( 'New password' ), 'new-password' );
        await user.click( within( password ).getByRole( 'button', { name: 'Update password' } ) );

        expect( await within( password ).findByRole( 'status' ) ).toHaveTextContent( 'Password changed. You\'re signed out on your other devices.' );
        expect( calls.find( ( call ) => call.path === '/auth/change-password' )?.body )
            .toEqual( { currentPassword: 'old-password', newPassword: 'new-password' } );
        expect( within( password ).getByLabelText( 'Current password' ) ).toHaveValue( '' );
        expect( within( password ).getByLabelText( 'New password' ) ).toHaveValue( '' );
    } );

    it( 'checks the passwords, and says when the current one is wrong', async () => {
        let answer = () => json( 401, { statusCode: 401, message: 'Wrong password' } );

        api( { 'POST /auth/change-password': () => answer() } );
        const user = userEvent.setup();

        renderApp( '/app/settings' );
        const password = await screen.findByRole( 'region', { name: 'Password' } );
        const current = within( password ).getByLabelText( 'Current password' );
        const next = within( password ).getByLabelText( 'New password' );
        const submit = within( password ).getByRole( 'button', { name: 'Update password' } );

        expect( next ).toHaveAccessibleDescription( 'At least 8 characters.' );
        await user.click( submit );
        expect( password ).toHaveTextContent( 'Enter your current password.' );
        expect( current ).toHaveFocus();

        await user.type( current, 'old-password' );
        await user.type( next, 'short' );
        await user.click( submit );
        expect( password ).toHaveTextContent( 'Use at least 8 characters.' );
        expect( next ).toHaveFocus();

        await user.type( next, '-but-long' );
        await user.click( submit );
        expect( await within( password ).findByText( 'That isn\'t your current password.' ) ).toBeInTheDocument();
        expect( current ).toHaveFocus();

        answer = () => {
            throw new TypeError( 'Failed to fetch' );
        };
        await user.click( submit );
        expect( await within( password ).findByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach StudyLog right now.' );

        answer = () => new Promise<Response>( () => undefined ) as unknown as Response;
        await user.click( submit );
        expect( await within( password ).findByRole( 'button', { name: 'Updating…' } ) ).toBeDisabled();
    } );

    it( 'deletes the account after the password, and goes to the homepage', async () => {
        let answer = () => json( 401, { statusCode: 401, message: 'Wrong password' } );
        const { calls } = api( { 'POST /auth/delete-account': () => answer() } );
        const user = userEvent.setup();

        renderApp( '/app/settings' );
        await user.click( await screen.findByRole( 'button', { name: 'Delete account' } ) );

        const dialog = screen.getByRole( 'dialog', { name: 'Delete your account?' } );
        const password = within( dialog ).getByLabelText( 'Password' );

        expect( password ).toHaveFocus();
        expect( dialog ).toHaveTextContent( 'It can\'t be undone.' );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Delete account' } ) );
        expect( dialog ).toHaveTextContent( 'Enter your password.' );

        await user.type( password, 'wrong' );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Delete account' } ) );
        expect( await within( dialog ).findByText( 'That isn\'t your password.' ) ).toBeInTheDocument();

        answer = () => json( 500, {} );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Delete account' } ) );
        expect( await within( dialog ).findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so nothing was saved.' );

        answer = () => noContent();
        await user.click( within( dialog ).getByRole( 'button', { name: 'Delete account' } ) );

        await waitFor( () => expect( screen.getByTestId( 'location' ) ).toHaveTextContent( /^\/$/ ) );
        expect( calls.filter( ( call ) => call.path === '/auth/delete-account' ).at( -1 )?.body ).toEqual( { password: 'wrong' } );
        expect( calls.some( ( call ) => call.path === '/auth/logout' ) ).toBe( false );
        expect( ( await screen.findAllByRole( 'link', { name: 'Log in' } ) ).length ).toBeGreaterThan( 0 );
    } );

    it( 'says to hand over an organization first, when that blocks deleting', async () => {
        api( {
            'POST /auth/delete-account': () => json( 409, {
                statusCode: 409,
                message: 'You\'re the only owner of "Acme Study Group": make someone else owner, or delete it, first',
            } ),
        } );
        const user = userEvent.setup();

        renderApp( '/app/settings' );
        await user.click( await screen.findByRole( 'button', { name: 'Delete account' } ) );
        await user.type( within( screen.getByRole( 'dialog' ) ).getByLabelText( 'Password' ), 'password123' );
        await user.click( within( screen.getByRole( 'dialog' ) ).getByRole( 'button', { name: 'Delete account' } ) );

        const dialog = await screen.findByRole( 'dialog', { name: 'Hand over your organization first' } );

        expect( within( dialog ).getByRole( 'alert' ) ).toHaveTextContent(
            'You\'re the only owner of "Acme Study Group", which has other members. Make someone else an owner, or delete the organization, before deleting your account.',
        );
        // The × button is also called Close; this is the one at the bottom.
        await user.click( within( dialog ).getAllByRole( 'button', { name: 'Close' } ).at( -1 )! );
        expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
        expect( screen.getByRole( 'heading', { level: 1, name: 'Settings' } ) ).toBeInTheDocument();
    } );

    it( 'closes the delete dialog without deleting', async () => {
        const { calls } = api();
        const user = userEvent.setup();

        renderApp( '/app/settings' );
        await user.click( await screen.findByRole( 'button', { name: 'Delete account' } ) );
        await user.click( screen.getByRole( 'button', { name: 'Cancel' } ) );

        expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
        expect( calls.some( ( call ) => call.path === '/auth/delete-account' ) ).toBe( false );
    } );

    it( 'waits while deleting', async () => {
        api( { 'POST /auth/delete-account': () => new Promise<Response>( () => undefined ) } );
        const user = userEvent.setup();

        renderApp( '/app/settings' );
        await user.click( await screen.findByRole( 'button', { name: 'Delete account' } ) );
        await user.type( within( screen.getByRole( 'dialog' ) ).getByLabelText( 'Password' ), 'password123' );
        await user.click( within( screen.getByRole( 'dialog' ) ).getByRole( 'button', { name: 'Delete account' } ) );

        expect( await screen.findByRole( 'button', { name: 'Deleting…' } ) ).toBeDisabled();
    } );
} );

describe( 'account forms', () => {
    it( 'checks names and passwords', () => {
        expect( validateProfile( 'Sam', 'Khan' ) ).toEqual( {} );
        expect( validateProfile( ' ', '' ) ).toEqual( { firstName: 'Enter your first name.', lastName: 'Enter your last name.' } );
        expect( validatePassword( 'old', 'long-enough' ) ).toEqual( {} );
        expect( validatePassword( '', '1234567' ) ).toEqual( {
            currentPassword: 'Enter your current password.',
            newPassword: 'Use at least 8 characters.',
        } );
        expect( validatePassword( 'same-password', 'same-password' ) )
            .toEqual( { newPassword: 'Choose a password that\'s different from your current one.' } );
    } );

    it( 'tells a wrong password from an expired session', () => {
        expect( isWrongPassword( new ApiError( 401, 'Wrong password' ) ) ).toBe( true );
        expect( isWrongPassword( new ApiError( 401, 'Unauthorized', { invalidToken: true } ) ) ).toBe( false );
        expect( isWrongPassword( new ApiError( 400, 'Bad' ) ) ).toBe( false );
        expect( saveError( new NetworkError() ) ).toMatch( /^Can't reach StudyLog/ );
    } );
} );
