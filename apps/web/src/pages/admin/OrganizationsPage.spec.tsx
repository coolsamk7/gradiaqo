import type { AdminOrganizationJson } from '@studylog/schemas';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, loggedIn, mockApi, pending, USER } from '../../test/api.ts';
import { uuid } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';

type Handlers = Parameters<typeof mockApi>[0];

const ADMIN = { ...USER, platformRole: 'superadmin' };
const ALICE = { id: uuid( 1 ), firstName: 'Alice', lastName: 'Walker', email: 'alice@example.com' };
const CLUB: AdminOrganizationJson = {
    id: uuid( 10 ),
    name: 'DSA Study Club',
    isPersonal: false,
    createdAt: '2026-09-02T10:00:00.000Z',
    memberCount: 12,
    pathCount: 3,
    owners: [ ALICE ],
};
const WORKSPACE: AdminOrganizationJson = { ...CLUB, id: uuid( 11 ), name: 'Alice\'s Workspace', isPersonal: true, memberCount: 1, pathCount: 0 };

const page = ( items: AdminOrganizationJson[], total = items.length ) => json( 200, { items, total } );

function api( handlers: Handlers = {} ) {
    return mockApi( {
        ...loggedIn,
        'GET /auth/me': () => json( 200, ADMIN ),
        'GET /admin/reports': () => json( 200, { items: [], total: 0 } ),
        'GET /admin/organizations': () => page( [ CLUB, WORKSPACE ] ),
        ...handlers,
    } );
}

const listCalls = ( calls: { method: string; path: string; query: string }[] ) =>
    calls.filter( ( call ) => call.path === '/admin/organizations' ).map( ( call ) => call.query );

describe( 'Admin › Organizations', () => {
    it( 'lists organizations with their owner and size, linking to each one', async () => {
        api();
        renderApp( '/app/admin/organizations' );

        const club = await screen.findByRole( 'row', { name: /DSA Study Club/ } );

        expect( screen.getByRole( 'heading', { level: 1, name: 'Organizations' } ) ).toBeInTheDocument();
        expect( within( screen.getByRole( 'navigation', { name: 'Admin' } ) ).getByRole( 'link', { name: 'Organizations' } ) )
            .toHaveAttribute( 'aria-current', 'page' );
        expect( club ).toHaveTextContent( 'DSA Study ClubAlice Walker123Sep 2026' );
        expect( within( club ).getByRole( 'link', { name: 'DSA Study Club' } ) ).toHaveAttribute( 'href', `/app/organizations/${CLUB.id}` );
        expect( screen.getByRole( 'row', { name: /Workspace/ } ) ).toHaveTextContent( 'Alice\'s WorkspacePersonalAlice Walker10' );
        expect( screen.queryByText( 'Loading the organizations…' ) ).not.toBeInTheDocument();
        expect( screen.queryByRole( 'button', { name: 'Try again' } ) ).not.toBeInTheDocument();
        expect( screen.queryByRole( 'button', { name: 'Next' } ) ).not.toBeInTheDocument();
    } );

    it( 'searches, and can include personal workspaces', async () => {
        const { calls } = api();
        const user = userEvent.setup();

        renderApp( '/app/admin/organizations' );
        await screen.findByRole( 'region', { name: 'Organizations' } );

        await user.type( screen.getByRole( 'searchbox', { name: 'Search organizations' } ), ' alice@ ' );
        await waitFor( () => expect( listCalls( calls ) ).toEqual( [ '?limit=50', '?search=alice%40&limit=50' ] ) );

        await user.selectOptions( screen.getByRole( 'combobox', { name: 'Kind' } ), 'Groups and personal workspaces' );
        await waitFor( () => expect( listCalls( calls ).at( -1 ) ).toBe( '?search=alice%40&personal=true&limit=50' ) );
        await user.selectOptions( screen.getByRole( 'combobox', { name: 'Kind' } ), 'Groups' );
        await waitFor( () => expect( listCalls( calls ).at( -1 ) ).toBe( '?search=alice%40&limit=50' ) );
    } );

    it( 'pages through many organizations', async () => {
        const { calls } = api( { 'GET /admin/organizations': () => page( [ CLUB ], 51 ) } );
        const user = userEvent.setup();

        renderApp( '/app/admin/organizations' );
        expect( await screen.findByText( '1–1 of 51' ) ).toBeInTheDocument();
        expect( screen.getByRole( 'button', { name: 'Previous' } ) ).toBeDisabled();

        await user.click( screen.getByRole( 'button', { name: 'Next' } ) );
        await waitFor( () => expect( listCalls( calls ).at( -1 ) ).toBe( '?limit=50&offset=50' ) );
        expect( await screen.findByRole( 'button', { name: 'Next' } ) ).toBeDisabled();

        await user.click( screen.getByRole( 'button', { name: 'Previous' } ) );
        await waitFor( () => expect( listCalls( calls ).at( -1 ) ).toBe( '?limit=50' ) );
        // Opening the page doesn't count as a new search: the page stays where it was.
        expect( listCalls( calls ) ).toEqual( [ '?limit=50', '?limit=50&offset=50', '?limit=50' ] );
    } );

    it( 'says when nothing matches, while loading, and on a load error', async () => {
        let answer: () => Response | Promise<Response> = () => pending();

        api( { 'GET /admin/organizations': () => answer() } );
        const user = userEvent.setup();

        renderApp( '/app/admin/organizations' );
        expect( await screen.findByText( 'Loading the organizations…' ) ).toBeInTheDocument();

        answer = () => json( 500, { statusCode: 500, message: 'Boom' } );
        await user.type( screen.getByRole( 'searchbox', { name: 'Search organizations' } ), 'x' );
        const retry = await screen.findByRole( 'button', { name: 'Try again' } );

        answer = () => page( [] );
        await user.click( retry );
        expect( await screen.findByText( 'No organizations match.' ) ).toBeInTheDocument();
    } );

    it( 'doesn\'t exist for anyone but superadmins', async () => {
        const { calls } = mockApi( loggedIn );

        renderApp( '/app/admin/organizations' );

        expect( await screen.findByRole( 'heading', { level: 1, name: 'Page not found' } ) ).toBeInTheDocument();
        expect( calls.some( ( call ) => call.path.startsWith( '/admin' ) ) ).toBe( false );
    } );
} );
