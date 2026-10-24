import type { MyInvitationJson, OrganizationSummaryJson } from '@studylog/schemas';
import { OrganizationRole } from '@studylog/schemas/enums';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, loggedIn, mockApi, noContent, pending, USER } from '../../test/api.ts';
import { organization, uuid } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';

type Handlers = Parameters<typeof mockApi>[0];

const person = ( n: number, firstName: string, lastName: string ) =>
    ( { userId: uuid( 600 + n ), firstName, lastName } );

const WORKSPACE: OrganizationSummaryJson = {
    ...organization(),
    memberCount: 1,
    pathCount: 3,
    members: [ { userId: USER.id, firstName: 'Sam', lastName: 'Khan' } ],
};
const CLUB: OrganizationSummaryJson = {
    ...organization( { id: uuid( 5 ), name: 'Acme Study Group', isPersonal: false } ),
    memberCount: 3,
    pathCount: 1,
    members: [ { userId: USER.id, firstName: 'Sam', lastName: 'Khan' }, person( 1, 'Bob', 'Singh' ), person( 2, 'Carol', 'Nguyen' ) ],
};
const BIG: OrganizationSummaryJson = {
    ...organization( { id: uuid( 6 ), name: 'Physics Club', isPersonal: false, role: OrganizationRole.Member } ),
    memberCount: 8,
    pathCount: 0,
    members: [ 1, 2, 3, 4, 5 ].map( ( n ) => person( n, `F${n}`, `L${n}` ) ),
};
const INVITATION: MyInvitationJson = {
    id: uuid( 700 ),
    organization: { id: uuid( 7 ), name: 'Chess Club' },
    role: OrganizationRole.Member,
    invitedBy: { id: uuid( 701 ), firstName: 'Carol', lastName: 'Nguyen' },
    expiresAt: new Date( Date.now() + 12 * 24 * 60 * 60 * 1000 - 60_000 ).toISOString(),
    createdAt: new Date().toISOString(),
};

function api( handlers: Handlers = {} ) {
    return mockApi( {
        ...loggedIn,
        'GET /organizations': () => json( 200, [ WORKSPACE, CLUB, BIG ] ),
        'GET /me/invitations': () => json( 200, [] ),
        ...handlers,
    } );
}

describe( 'OrganizationsPage', () => {
    it( 'shows a card per organization, the personal workspace first', async () => {
        api();
        renderApp( '/app/organizations' );

        const cards = within( await screen.findByRole( 'list', { name: 'Your organizations' } ) ).getAllByRole( 'listitem' );

        expect( screen.getByRole( 'heading', { level: 1, name: 'Organizations' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'link', { name: 'Organizations' } ) ).toHaveAttribute( 'aria-current', 'page' );
        expect( cards ).toHaveLength( 3 );

        const [ workspace, club, big ] = cards.map( ( card ) => within( card ) );

        expect( cards[0] ).toHaveTextContent( 'Sam\'s Workspace3 pathsPersonalYour own paths and items.' );
        expect( workspace.getByRole( 'link', { name: 'Open workspace' } ) ).toHaveAttribute( 'href', `/app/my-paths?org=${WORKSPACE.id}` );
        expect( cards[1] ).toHaveTextContent( 'Acme Study Group3 members · 1 pathOwnerCreated Sep 2026.' );
        expect( club.getByRole( 'img', { name: 'Members: Sam Khan, Bob Singh, Carol Nguyen' } ) ).toHaveTextContent( 'SKBSCN' );
        expect( club.getByRole( 'link', { name: 'Manage Acme Study Group' } ) ).toHaveAttribute( 'href', `/app/organizations/${CLUB.id}` );
        expect( cards[2] ).toHaveTextContent( 'Physics Club8 members · 0 pathsMember' );
        expect( big.getByRole( 'img', { name: 'Members: F1 L1, F2 L2, F3 L3, F4 L4, F5 L5 and 3 more' } ) ).toHaveTextContent( '+3' );
        expect( big.getByRole( 'link', { name: 'Open Physics Club' } ) ).toHaveTextContent( 'Open' );
        expect( screen.queryByRole( 'region', { name: 'Invitations for you' } ) ).not.toBeInTheDocument();
    } );

    it( 'shows invitations for the user, to accept or decline', async () => {
        const fromSomeone = { ...INVITATION, id: uuid( 702 ), role: OrganizationRole.Admin, invitedBy: null };
        let invitations = [ INVITATION, fromSomeone ];
        let answer = () => json( 500, {} );
        const { calls } = api( {
            'GET /me/invitations': () => json( 200, invitations ),
            [`POST /me/invitations/${INVITATION.id}/accept`]: () => answer(),
            [`POST /me/invitations/${uuid( 702 )}/decline`]: () => noContent(),
        } );
        const user = userEvent.setup();

        renderApp( '/app/organizations' );

        const region = await screen.findByRole( 'region', { name: 'Invitations for you' } );
        const rows = within( region ).getAllByRole( 'listitem' );

        expect( region ).toHaveTextContent( '2 new' );
        expect( rows[0] ).toHaveTextContent( 'Chess Club invited you as a MemberFrom Carol Nguyen · expires in 12 days' );
        expect( rows[1] ).toHaveTextContent( 'Chess Club invited you as an Adminexpires in 12 days' );

        await user.click( within( rows[0] ).getByRole( 'button', { name: 'Accept' } ) );
        expect( await within( region ).findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so nothing changed.' );

        answer = () => json( 200, CLUB );
        invitations = [ invitations[1] ];
        await user.click( within( rows[0] ).getByRole( 'button', { name: 'Accept' } ) );
        // The lists load again: the invitation is gone, and the new organization shows up.
        const invites = () => within( screen.getByRole( 'region', { name: 'Invitations for you' } ) );

        await waitFor( () => expect( invites().getAllByRole( 'listitem' ) ).toHaveLength( 1 ) );
        expect( calls.filter( ( call ) => call.path === '/organizations' ) ).toHaveLength( 2 );

        invitations = [];
        await user.click( invites().getByRole( 'button', { name: 'Decline' } ) );
        await waitFor( () => expect( screen.queryByRole( 'region', { name: 'Invitations for you' } ) ).not.toBeInTheDocument() );
        // Declining doesn't change the organizations.
        expect( calls.filter( ( call ) => call.path === '/organizations' ) ).toHaveLength( 2 );
    } );

    it( 'shows a skeleton while loading, and a way to try again', async () => {
        let answer: () => Response | Promise<Response> = pending;

        api( { 'GET /organizations': () => answer() } );
        const loading = renderApp( '/app/organizations' );

        expect( await screen.findByText( 'Loading your organizations…' ) ).toHaveAttribute( 'role', 'status' );
        // Gone before the answers change: on a slow machine its request could otherwise get them too.
        loading.unmount();

        answer = () => json( 500, {} );
        renderApp( '/app/organizations' );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong while loading.' );

        answer = () => json( 200, [ WORKSPACE ] );
        await userEvent.setup().click( screen.getByRole( 'button', { name: 'Try again' } ) );
        expect( await screen.findByRole( 'link', { name: 'Open workspace' } ) ).toBeInTheDocument();
    } );

    it( 'creates an organization, then opens it', async () => {
        let answer = () => json( 500, {} );
        const { calls } = api( {
            'POST /organizations': () => answer(),
            [`GET /organizations/${CLUB.id}`]: pending,
            [`GET /organizations/${CLUB.id}/members`]: pending,
        } );
        const user = userEvent.setup();

        renderApp( '/app/organizations' );
        await user.click( await screen.findByRole( 'button', { name: 'New organization' } ) );

        const dialog = screen.getByRole( 'dialog', { name: 'New organization' } );
        const name = within( dialog ).getByLabelText( 'Name' );

        expect( name ).toHaveFocus();
        await user.click( within( dialog ).getByRole( 'button', { name: 'Create organization' } ) );
        expect( name ).toHaveAccessibleDescription( 'Enter a name.' );

        await user.type( name, '  Acme Study Group ' );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Create organization' } ) );
        expect( await within( dialog ).findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so nothing changed.' );

        answer = () => json( 201, CLUB );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Create organization' } ) );

        await waitFor( () => expect( screen.getByTestId( 'location' ) ).toHaveTextContent( `/app/organizations/${CLUB.id}` ) );
        expect( calls.filter( ( call ) => call.method === 'POST' && call.path === '/organizations' ).at( -1 )?.body )
            .toEqual( { name: 'Acme Study Group' } );
    } );

    it( 'closes the new organization dialog without creating one', async () => {
        const { calls } = api( { 'POST /organizations': pending } );
        const user = userEvent.setup();

        renderApp( '/app/organizations' );
        await user.click( await screen.findByRole( 'button', { name: 'New organization' } ) );
        await user.type( screen.getByLabelText( 'Name' ), 'Group' );
        await user.click( screen.getByRole( 'button', { name: 'Create organization' } ) );
        expect( screen.getByRole( 'button', { name: 'Creating…' } ) ).toBeDisabled();
        await user.click( screen.getByRole( 'button', { name: 'Cancel' } ) );

        expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
        expect( calls.filter( ( call ) => call.method === 'POST' && call.path === '/organizations' ) ).toHaveLength( 1 );
    } );
} );
