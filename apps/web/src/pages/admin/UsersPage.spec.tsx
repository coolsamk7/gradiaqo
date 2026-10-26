import type { AdminUserJson } from '@studylog/schemas';
import { PlatformRole } from '@studylog/schemas/enums';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, loggedIn, mockApi, noContent, pending, USER } from '../../test/api.ts';
import { uuid } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';

type Handlers = Parameters<typeof mockApi>[0];

const ADMIN = { ...USER, platformRole: PlatformRole.Superadmin, lastActiveAt: new Date().toISOString() };
const ALICE: AdminUserJson = {
    ...USER,
    id: uuid( 1 ),
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Walker',
    platformRole: PlatformRole.ApplicationUser,
    emailVerifiedAt: null,
    lastActiveAt: null,
    createdAt: '2026-09-02T10:00:00.000Z',
};
const ADA: AdminUserJson = { ...ALICE, id: uuid( 2 ), email: 'ada@example.com', firstName: 'Ada', lastName: 'Admin', platformRole: PlatformRole.Superadmin };

const page = ( items: AdminUserJson[], total = items.length ) => json( 200, { items, total } );

function api( handlers: Handlers = {} ) {
    return mockApi( {
        ...loggedIn,
        'GET /auth/me': () => json( 200, ADMIN ),
        'GET /admin/users': () => page( [ ADMIN, ALICE, ADA ] ),
        ...handlers,
    } );
}

const row = ( email: string ) => screen.getByRole( 'row', { name: new RegExp( email ) } );
const usersCalls = ( calls: { method: string; path: string; query: string }[] ) =>
    calls.filter( ( call ) => call.method === 'GET' && call.path === '/admin/users' ).map( ( call ) => call.query );

describe( 'UsersPage', () => {
    it( 'lists every user with their role, email status, when they joined and when they were last active', async () => {
        api();
        renderApp( '/app/admin/users' );

        expect( await screen.findByRole( 'row', { name: /sam@/ } ) ).toBeInTheDocument();
        expect( screen.queryByText( 'Loading the users…' ) ).not.toBeInTheDocument();
        expect( screen.getByRole( 'heading', { level: 1, name: 'Users' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'link', { name: 'Back to the global catalog' } ) ).toHaveAttribute( 'href', '/app/admin/catalog' );
        expect( row( 'sam@example.com' ) ).toHaveTextContent( 'Sam Khan (you)sam@example.comSuperadminVerifiedJan 2026Today' );
        expect( row( 'alice@example.com' ) ).toHaveTextContent( 'Alice Walkeralice@example.comUserNot verifiedSep 2026Never' );
        // Nothing to do to yourself.
        await userEvent.click( within( row( 'sam@example.com' ) ).getByRole( 'button', { name: 'More for sam@example.com' } ) );
        expect( within( row( 'sam@example.com' ) ).queryAllByRole( 'listitem' ) ).toHaveLength( 0 );
    } );

    it( 'is reached from the global catalog', async () => {
        api( { 'GET /admin/catalog/paths': () => json( 200, [] ), 'GET /admin/reports': () => json( 200, { items: [], total: 0 } ) } );
        renderApp( '/app/admin/catalog' );

        expect( await screen.findByRole( 'link', { name: 'Users' } ) ).toHaveAttribute( 'href', '/app/admin/users' );
    } );

    it( 'searches by email or name, and filters by role and email status', async () => {
        const { calls } = api();
        const user = userEvent.setup();

        renderApp( '/app/admin/users' );
        await screen.findByRole( 'region', { name: 'Users' } );

        await user.type( screen.getByRole( 'searchbox', { name: 'Search users' } ), ' ali ' );
        await waitFor( () => expect( usersCalls( calls ) ).toContain( '?search=ali&limit=50' ) );
        // One request for the word, not one per letter.
        expect( usersCalls( calls ) ).toEqual( [ '?limit=50', '?search=ali&limit=50' ] );

        await user.selectOptions( screen.getByRole( 'combobox', { name: 'Role' } ), 'Superadmins' );
        await user.selectOptions( screen.getByRole( 'combobox', { name: 'Email' } ), 'Not verified' );
        await waitFor( () => expect( usersCalls( calls ).at( -1 ) ).toBe( '?search=ali&role=superadmin&verified=false&limit=50' ) );
    } );

    it( 'shows that the users are loading', async () => {
        api( { 'GET /admin/users': () => pending() } );
        renderApp( '/app/admin/users' );

        expect( await screen.findByText( 'Loading the users…' ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'region', { name: 'Users' } ) ).not.toBeInTheDocument();
    } );

    it( 'has no pages for 50 users or fewer', async () => {
        api( { 'GET /admin/users': () => page( [ ALICE ], 50 ) } );
        renderApp( '/app/admin/users' );

        await screen.findByRole( 'row', { name: /alice@/ } );
        expect( screen.queryByRole( 'button', { name: 'Next' } ) ).not.toBeInTheDocument();
    } );

    it( 'says when nobody matches', async () => {
        api( { 'GET /admin/users': () => page( [] ) } );
        renderApp( '/app/admin/users' );

        expect( await screen.findByText( 'No users match.' ) ).toBeInTheDocument();
    } );

    it( 'pages through many users', async () => {
        const { calls } = api( { 'GET /admin/users': () => page( [ ALICE ], 120 ) } );
        const user = userEvent.setup();

        renderApp( '/app/admin/users' );
        expect( await screen.findByText( '1–1 of 120' ) ).toBeInTheDocument();
        expect( screen.getByRole( 'button', { name: 'Previous' } ) ).toBeDisabled();

        await user.click( screen.getByRole( 'button', { name: 'Next' } ) );
        await waitFor( () => expect( usersCalls( calls ).at( -1 ) ).toBe( '?limit=50&offset=50' ) );
        await user.click( await screen.findByRole( 'button', { name: 'Next' } ) );
        await waitFor( () => expect( usersCalls( calls ).at( -1 ) ).toBe( '?limit=50&offset=100' ) );
        expect( await screen.findByRole( 'button', { name: 'Next' } ) ).toBeDisabled();

        await user.click( screen.getByRole( 'button', { name: 'Previous' } ) );
        await waitFor( () => expect( usersCalls( calls ).at( -1 ) ).toBe( '?limit=50&offset=50' ) );
    } );

    it( 'promotes and demotes superadmins, showing why a change was refused', async () => {
        let answer = () => json( 400, { statusCode: 400, message: 'You can\'t change your own role' } );
        const { calls } = api( {
            [`PATCH /admin/users/${ALICE.id}`]: () => answer(),
            [`PATCH /admin/users/${ADA.id}`]: () => json( 200, { ...ADA, platformRole: PlatformRole.ApplicationUser } ),
        } );
        const user = userEvent.setup();

        renderApp( '/app/admin/users' );
        await user.click( within( await screen.findByRole( 'row', { name: /alice@/ } ) ).getByRole( 'button', { name: 'More for alice@example.com' } ) );
        await user.click( screen.getByRole( 'button', { name: 'Make superadmin' } ) );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'You can\'t change your own role.' );

        answer = () => json( 200, { ...ALICE, platformRole: PlatformRole.Superadmin } );
        await user.click( within( row( 'alice@example.com' ) ).getByRole( 'button', { name: 'More for alice@example.com' } ) );
        await user.click( screen.getByRole( 'button', { name: 'Make superadmin' } ) );
        await waitFor( () => expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument() );

        await user.click( within( row( 'ada@example.com' ) ).getByRole( 'button', { name: 'More for ada@example.com' } ) );
        expect( screen.queryByRole( 'button', { name: 'Remove account' } ) ).not.toBeInTheDocument();
        await user.click( screen.getByRole( 'button', { name: 'Make normal user' } ) );

        const patches = calls.filter( ( call ) => call.method === 'PATCH' ).map( ( call ) => [ call.path, call.body ] );

        expect( patches ).toEqual( [
            [ `/admin/users/${ALICE.id}`, { platformRole: 'superadmin' } ],
            [ `/admin/users/${ALICE.id}`, { platformRole: 'superadmin' } ],
            [ `/admin/users/${ADA.id}`, { platformRole: 'application_user' } ],
        ] );
        // The list is loaded again after each change.
        await waitFor( () => expect( usersCalls( calls ) ).toHaveLength( 3 ) );
    } );

    it( 'removes an account once its email is typed, or says why it can\'t', async () => {
        let answer = () => json( 409, { statusCode: 409, message: 'They\'re the only owner of "Club", which has other members: someone else has to become owner first' } );
        const { calls } = api( { [`DELETE /admin/users/${ALICE.id}`]: () => answer() } );
        const user = userEvent.setup();

        renderApp( '/app/admin/users' );
        await user.click( within( await screen.findByRole( 'row', { name: /alice@/ } ) ).getByRole( 'button', { name: 'More for alice@example.com' } ) );
        await user.click( screen.getByRole( 'button', { name: 'Remove account' } ) );

        const dialog = within( screen.getByRole( 'dialog', { name: 'Remove Alice Walker?' } ) );
        const confirm = dialog.getByLabelText( 'Type their email to confirm' );

        expect( confirm ).toHaveFocus();
        await user.type( confirm, 'alice@' );
        await user.click( dialog.getByRole( 'button', { name: 'Remove account' } ) );
        expect( dialog.getByText( 'Type the email exactly as it is shown.' ) ).toBeInTheDocument();
        expect( calls.some( ( call ) => call.method === 'DELETE' ) ).toBe( false );

        await user.type( confirm, 'Example.com ' );
        await user.click( dialog.getByRole( 'button', { name: 'Remove account' } ) );
        expect( await dialog.findByRole( 'alert' ) ).toHaveTextContent( 'They\'re the only owner of "Club", which has other members' );
        expect( dialog.queryByText( 'Type the email exactly as it is shown.' ) ).not.toBeInTheDocument();

        // A new attempt starts without the old refusal.
        await user.type( confirm, 'x' );
        await user.click( dialog.getByRole( 'button', { name: 'Remove account' } ) );
        expect( dialog.queryByRole( 'alert' ) ).not.toBeInTheDocument();

        answer = () => noContent();
        await user.type( confirm, '{Backspace}' );
        await user.click( dialog.getByRole( 'button', { name: 'Remove account' } ) );
        await waitFor( () => expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument() );
        expect( usersCalls( calls ) ).toHaveLength( 2 );
    } );

    it( 'waits while removing, and can be cancelled', async () => {
        api( { [`DELETE /admin/users/${ALICE.id}`]: () => pending() } );
        const user = userEvent.setup();

        renderApp( '/app/admin/users' );
        const more = async () => {
            await user.click( within( await screen.findByRole( 'row', { name: /alice@/ } ) ).getByRole( 'button', { name: 'More for alice@example.com' } ) );
            await user.click( screen.getByRole( 'button', { name: 'Remove account' } ) );
        };

        await more();
        await user.click( screen.getByRole( 'button', { name: 'Cancel' } ) );
        expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();

        await more();
        await user.type( screen.getByLabelText( 'Type their email to confirm' ), 'alice@example.com' );
        await user.click( within( screen.getByRole( 'dialog' ) ).getByRole( 'button', { name: 'Remove account' } ) );
        expect( await screen.findByRole( 'button', { name: 'Removing…' } ) ).toBeDisabled();
    } );

    it( 'shows a load error with a retry', async () => {
        let answer = () => json( 500, { statusCode: 500, message: 'Boom' } );

        api( { 'GET /admin/users': () => answer() } );
        const user = userEvent.setup();

        renderApp( '/app/admin/users' );
        await user.click( await screen.findByRole( 'button', { name: 'Try again' } ) );
        answer = () => page( [ ALICE ] );
        await user.click( await screen.findByRole( 'button', { name: 'Try again' } ) );
        expect( await screen.findByRole( 'row', { name: /alice@/ } ) ).toBeInTheDocument();
    } );

    it( 'doesn\'t exist for anyone but superadmins', async () => {
        const { calls } = mockApi( loggedIn );

        renderApp( '/app/admin/users' );

        expect( await screen.findByRole( 'heading', { level: 1, name: 'Page not found' } ) ).toBeInTheDocument();
        expect( calls.some( ( call ) => call.path.startsWith( '/admin' ) ) ).toBe( false );
    } );
} );
