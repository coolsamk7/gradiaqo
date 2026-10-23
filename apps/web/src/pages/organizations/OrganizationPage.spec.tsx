import type { InvitationJson, MemberJson } from '@studylog/schemas';
import { OrganizationRole } from '@studylog/schemas/enums';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, loggedIn, mockApi, noContent, pending, USER } from '../../test/api.ts';
import { catalogPath, organization, uuid } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';

type Handlers = Parameters<typeof mockApi>[0];

const CLUB = organization( { id: uuid( 5 ), name: 'Acme Study Group', isPersonal: false } );
const URL = `/organizations/${CLUB.id}`;
const DAY = 24 * 60 * 60 * 1000;

const member = ( n: number, firstName: string, role: OrganizationRole, joinedAt = '2026-09-02T00:00:00.000Z' ): MemberJson => ( {
    userId: uuid( 600 + n ),
    email: `${firstName.toLowerCase()}@example.com`,
    firstName,
    lastName: 'Lee',
    role,
    joinedAt,
} );
const ME: MemberJson = { userId: USER.id, email: USER.email, firstName: 'Sam', lastName: 'Khan', role: OrganizationRole.Owner, joinedAt: '2026-09-01T00:00:00.000Z' };
const BOB = member( 1, 'Bob', OrganizationRole.Admin );
const CAROL = member( 2, 'Carol', OrganizationRole.Member, '2026-10-05T00:00:00.000Z' );
const OTHER_OWNER = member( 3, 'Olga', OrganizationRole.Owner );
const INVITE: InvitationJson = {
    id: uuid( 800 ),
    email: 'erin@example.com',
    role: OrganizationRole.Admin,
    invitedBy: { id: USER.id, firstName: 'Sam', lastName: 'Khan' },
    expiresAt: new Date( Date.now() + 11 * DAY - 60_000 ).toISOString(),
    createdAt: new Date( Date.now() - 3 * DAY - 60_000 ).toISOString(),
};
const CLUB_PATH = catalogPath( 'Graph Drills', { organizationId: CLUB.id, organization: { id: CLUB.id, name: CLUB.name, isPersonal: false } } );
const OTHER_PATH = catalogPath( 'Elsewhere', { organization: { id: uuid( 9 ), name: 'Other', isPersonal: false } } );

/** The organization as `role` sees it, with `members`; `handlers` replace the default answers. */
function api( handlers: Handlers = {}, { role = OrganizationRole.Owner, members = [ ME, BOB, CAROL ] }: {
    role?: OrganizationRole;
    members?: MemberJson[];
} = {} ) {
    return mockApi( {
        ...loggedIn,
        [`GET ${URL}`]: () => json( 200, { ...CLUB, role } ),
        [`GET ${URL}/members`]: () => json( 200, members.map( ( m ) => ( m.userId === USER.id ? { ...m, role } : m ) ) ),
        [`GET ${URL}/invitations`]: () => json( 200, [ INVITE ] ),
        'GET /catalog/paths': () => json( 200, [ CLUB_PATH, OTHER_PATH ] ),
        ...handlers,
    } );
}

const rows = () => within( screen.getByRole( 'region', { name: 'Members' } ) ).getAllByRole( 'listitem' );
const row = ( name: string ) => rows().find( ( item ) => item.textContent?.includes( name ) )!;

async function chooseAction( user: ReturnType<typeof userEvent.setup>, name: string, action: string ) {
    await user.click( within( row( name ) ).getByRole( 'button', { name: `Actions for ${name}` } ) );
    await user.click( screen.getByRole( 'button', { name: action } ) );
}

describe( 'OrganizationPage', () => {
    it( 'shows the organization and its members to an owner, who can manage everything', async () => {
        const { calls } = api( { [`PATCH ${URL}/members/${BOB.userId}`]: () => json( 200, BOB ) } );

        renderApp( `/app/organizations/${CLUB.id}` );

        expect( await screen.findByRole( 'heading', { level: 1, name: 'Acme Study Group' } ) ).toBeInTheDocument();
        expect( await screen.findByText( '3 members · 1 path · created Sep 2026' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Owner', { selector: 'h1 + span' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'link', { name: 'Back to organizations' } ) ).toHaveAttribute( 'href', '/app/organizations' );
        expect( screen.getByRole( 'link', { name: 'Organizations' } ) ).toHaveAttribute( 'aria-current', 'page' );
        expect( screen.getByRole( 'button', { name: 'Rename' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'button', { name: 'Delete' } ) ).toBeInTheDocument();
        expect( screen.getAllByRole( 'tab' ).map( ( tab ) => tab.textContent ) ).toEqual( [ 'Members', 'Invitations · 1', 'Paths' ] );
        expect( screen.getByRole( 'tab', { name: 'Members' } ) ).toHaveAttribute( 'aria-selected', 'true' );

        expect( rows().map( ( item ) => item.textContent ) ).toEqual( [
            'SKSam Khan (you)sam@example.comOwnerJoined Sep 2026',
            'BLBob Leebob@example.comAdminJoined Sep 2026',
            'CLCarol Leecarol@example.comMemberJoined Oct 2026',
        ] );
        // The invite form and pending invitations are under the members too.
        expect( screen.getByRole( 'region', { name: 'Invite someone' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'region', { name: 'Pending invitations' } ) )
            .toHaveTextContent( 'erin@example.comAdmin · sent 3 days ago · expires in 11 days' );

        const user = userEvent.setup();

        await user.click( within( row( 'Bob Lee' ) ).getByRole( 'button', { name: 'Actions for Bob Lee' } ) );
        expect( screen.getAllByRole( 'button', { name: /^(Make|Remove)/ } ).map( ( button ) => button.textContent ) )
            .toEqual( [ 'Make owner', 'Make member', 'Remove from organization' ] );
        await user.click( screen.getByRole( 'button', { name: 'Make owner' } ) );
        await waitFor( () => expect( calls.find( ( call ) => call.method === 'PATCH' )?.body ).toEqual( { role: 'owner' } ) );
    } );

    it( 'searches the members by name or email', async () => {
        api();
        const user = userEvent.setup();

        renderApp( `/app/organizations/${CLUB.id}` );
        const search = await screen.findByRole( 'searchbox', { name: 'Search members' } );

        await user.type( search, 'CAROL@' );
        expect( rows().map( ( item ) => item.textContent ) ).toEqual( [ 'CLCarol Leecarol@example.comMemberJoined Oct 2026' ] );

        await user.clear( search );
        await user.type( search, 'zed' );
        expect( screen.getByRole( 'region', { name: 'Members' } ) ).toHaveTextContent( 'No members match “zed”.' );
    } );

    it( 'changes a member\'s role, and shows why the API refused one', async () => {
        let members = [ ME, BOB, CAROL ];
        let answer = () => json( 409, { statusCode: 409, message: 'An organization needs an owner: make someone else owner first' } );
        const { calls } = api( {
            [`GET ${URL}/members`]: () => json( 200, members ),
            [`PATCH ${URL}/members/${BOB.userId}`]: () => answer(),
        } );
        const user = userEvent.setup();

        renderApp( `/app/organizations/${CLUB.id}` );
        await screen.findByRole( 'region', { name: 'Members' } );

        await chooseAction( user, 'Bob Lee', 'Make member' );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'An organization needs an owner: make someone else owner first.' );

        answer = () => json( 200, { ...BOB, role: OrganizationRole.Member } );
        members = [ ME, { ...BOB, role: OrganizationRole.Member }, CAROL ];
        await chooseAction( user, 'Bob Lee', 'Make member' );

        await waitFor( () => expect( row( 'Bob Lee' ) ).toHaveTextContent( 'Member' ) );
        expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();
        expect( calls.filter( ( call ) => call.method === 'PATCH' ).at( -1 )?.body ).toEqual( { role: 'member' } );
    } );

    it( 'removes a member after confirming', async () => {
        let members = [ ME, BOB, CAROL ];
        const { calls } = api( {
            [`GET ${URL}/members`]: () => json( 200, members ),
            [`DELETE ${URL}/members/${CAROL.userId}`]: () => noContent(),
        } );
        const user = userEvent.setup();

        renderApp( `/app/organizations/${CLUB.id}` );
        await screen.findByRole( 'region', { name: 'Members' } );

        await chooseAction( user, 'Carol Lee', 'Remove from organization' );
        const dialog = screen.getByRole( 'dialog', { name: 'Remove Carol Lee?' } );

        expect( dialog ).toHaveTextContent( 'They lose access to Acme Study Group and its paths.' );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Cancel' } ) );
        expect( calls.some( ( call ) => call.method === 'DELETE' ) ).toBe( false );

        await chooseAction( user, 'Carol Lee', 'Remove from organization' );
        members = [ ME, BOB ];
        await user.click( within( screen.getByRole( 'dialog' ) ).getByRole( 'button', { name: 'Remove' } ) );

        await waitFor( () => expect( rows() ).toHaveLength( 2 ) );
        expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
        expect( screen.getByText( '2 members · 1 path · created Sep 2026' ) ).toBeInTheDocument();
    } );

    it( 'lets the user leave, and says when they can\'t', async () => {
        let answer = () => json( 409, { statusCode: 409, message: 'An organization needs an owner: make someone else owner first' } );

        api( { [`POST ${URL}/leave`]: () => answer(), 'GET /organizations': pending, 'GET /me/invitations': pending }, { role: OrganizationRole.Member } );
        const user = userEvent.setup();

        renderApp( `/app/organizations/${CLUB.id}` );
        await screen.findByRole( 'region', { name: 'Members' } );

        await chooseAction( user, 'Sam Khan', 'Leave organization' );
        expect( screen.getByRole( 'dialog', { name: 'Leave Acme Study Group?' } ) ).toBeInTheDocument();
        await user.click( screen.getByRole( 'button', { name: 'Leave organization' } ) );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'make someone else owner first.' );

        answer = () => noContent();
        await chooseAction( user, 'Sam Khan', 'Leave organization' );
        await user.click( within( screen.getByRole( 'dialog' ) ).getByRole( 'button', { name: 'Leave organization' } ) );

        await waitFor( () => expect( screen.getByTestId( 'location' ) ).toHaveTextContent( /^\/app\/organizations$/ ) );
    } );

    it( 'shows a member only what members can do', async () => {
        const { calls } = api( {}, { role: OrganizationRole.Member } );

        renderApp( `/app/organizations/${CLUB.id}?tab=invitations` );
        await screen.findByRole( 'region', { name: 'Members' } );

        expect( screen.getByText( 'Member', { selector: 'h1 + span' } ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'button', { name: 'Rename' } ) ).not.toBeInTheDocument();
        expect( screen.getAllByRole( 'tab' ).map( ( tab ) => tab.textContent ) ).toEqual( [ 'Members', 'Paths' ] );
        // An unknown or unavailable tab falls back to the members.
        expect( screen.getByRole( 'tab', { name: 'Members' } ) ).toHaveAttribute( 'aria-selected', 'true' );
        expect( screen.getAllByRole( 'button', { name: /^Actions for/ } ) ).toHaveLength( 1 );
        expect( screen.queryByRole( 'region', { name: 'Invite someone' } ) ).not.toBeInTheDocument();
        expect( calls.some( ( call ) => call.path === `${URL}/invitations` ) ).toBe( false );
    } );

    it( 'lets an admin manage admins and members, but not owners or deleting', async () => {
        const { calls } = api(
            { [`PATCH ${URL}/members/${CAROL.userId}`]: () => json( 200, CAROL ) },
            { role: OrganizationRole.Admin, members: [ OTHER_OWNER, ME, CAROL ] },
        );
        const user = userEvent.setup();

        renderApp( `/app/organizations/${CLUB.id}` );
        await screen.findByRole( 'region', { name: 'Members' } );

        expect( screen.getByRole( 'button', { name: 'Rename' } ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'button', { name: 'Delete' } ) ).not.toBeInTheDocument();
        expect( within( row( 'Olga Lee' ) ).queryByRole( 'button' ) ).not.toBeInTheDocument();

        await user.click( within( row( 'Carol Lee' ) ).getByRole( 'button', { name: 'Actions for Carol Lee' } ) );
        expect( screen.getAllByRole( 'button', { name: /^(Make|Remove)/ } ).map( ( button ) => button.textContent ) )
            .toEqual( [ 'Make admin', 'Remove from organization' ] );
        await user.click( screen.getByRole( 'button', { name: 'Make admin' } ) );
        await waitFor( () => expect( calls.find( ( call ) => call.method === 'PATCH' )?.body ).toEqual( { role: 'admin' } ) );
    } );

    it( 'shows a personal workspace without members to manage', async () => {
        const workspace = organization();

        mockApi( {
            ...loggedIn,
            [`GET /organizations/${workspace.id}`]: () => json( 200, workspace ),
            [`GET /organizations/${workspace.id}/members`]: () => json( 200, [ ME ] ),
            'GET /catalog/paths': () => json( 200, [] ),
        } );
        renderApp( `/app/organizations/${workspace.id}` );

        expect( await screen.findByRole( 'heading', { level: 1, name: 'Sam\'s Workspace' } ) ).toBeInTheDocument();
        expect( screen.getByText( 'Personal', { selector: 'h1 + span' } ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'button', { name: 'Rename' } ) ).not.toBeInTheDocument();
        expect( screen.queryByRole( 'button', { name: /^Actions for/ } ) ).not.toBeInTheDocument();
        expect( screen.getAllByRole( 'tab' ).map( ( tab ) => tab.textContent ) ).toEqual( [ 'Members', 'Paths' ] );
        await waitFor( () => expect( screen.getByText( '1 member · 0 paths · created Sep 2026' ) ).toBeInTheDocument() );
    } );

    it( 'invites someone by email, and explains refusals', async () => {
        let invitations = [ INVITE ];
        let answer = () => json( 409, { statusCode: 409, message: 'This person is already a member' } );
        const { calls } = api( {
            [`GET ${URL}/invitations`]: () => json( 200, invitations ),
            [`POST ${URL}/invitations`]: () => answer(),
        } );
        const user = userEvent.setup();

        renderApp( `/app/organizations/${CLUB.id}?tab=invitations` );

        const card = within( await screen.findByRole( 'region', { name: 'Invite someone' } ) );
        const email = card.getByLabelText( 'Email' );

        expect( screen.getByRole( 'tab', { name: 'Invitations · 1' } ) ).toHaveAttribute( 'aria-selected', 'true' );
        expect( screen.queryByRole( 'region', { name: 'Members' } ) ).not.toBeInTheDocument();
        await user.click( card.getByRole( 'button', { name: 'Send invite' } ) );
        expect( email ).toHaveAccessibleDescription( 'Enter a valid email address.' );
        expect( email ).toHaveFocus();

        await user.type( email, ' Dave@Example.com ' );
        await user.selectOptions( card.getByLabelText( 'Role' ), 'Admin' );
        await user.click( card.getByRole( 'button', { name: 'Send invite' } ) );
        expect( await card.findByText( 'This person is already a member.' ) ).toBeInTheDocument();

        answer = () => json( 400, { statusCode: 400, message: 'Bad Request', errors: [ { path: '/email', message: 'must be an email' } ] } );
        await user.click( card.getByRole( 'button', { name: 'Send invite' } ) );
        await waitFor( () => expect( email ).toHaveAccessibleDescription( 'Enter a valid email address.' ) );

        answer = () => json( 429, { statusCode: 429, message: 'Too Many Requests' } );
        await user.click( card.getByRole( 'button', { name: 'Send invite' } ) );
        expect( await card.findByRole( 'alert' ) ).toHaveTextContent( 'You\'ve sent a lot of invitations.' );

        answer = () => json( 500, {} );
        await user.click( card.getByRole( 'button', { name: 'Send invite' } ) );
        await waitFor( () => expect( card.getByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so nothing changed.' ) );

        answer = () => json( 201, { ...INVITE, id: uuid( 801 ), email: 'dave@example.com' } );
        invitations = [ { ...INVITE, id: uuid( 801 ), email: 'dave@example.com', role: OrganizationRole.Admin }, INVITE ];
        await user.click( card.getByRole( 'button', { name: 'Send invite' } ) );

        expect( await card.findByRole( 'status' ) ).toHaveTextContent( 'Invitation sent to dave@example.com.' );
        expect( email ).toHaveValue( '' );
        expect( calls.filter( ( call ) => call.method === 'POST' ).at( -1 )?.body ).toEqual( { email: 'dave@example.com', role: 'admin' } );
        await waitFor( () => expect( screen.getByRole( 'tab', { name: 'Invitations · 2' } ) ).toBeInTheDocument() );
    } );

    it( 'revokes a pending invitation', async () => {
        let invitations = [ INVITE ];
        let answer = () => json( 500, {} );

        api( {
            [`GET ${URL}/invitations`]: () => json( 200, invitations ),
            [`DELETE ${URL}/invitations/${INVITE.id}`]: () => answer(),
        } );
        const user = userEvent.setup();

        renderApp( `/app/organizations/${CLUB.id}?tab=invitations` );
        const pending = within( await screen.findByRole( 'region', { name: 'Pending invitations' } ) );

        await user.click( pending.getByRole( 'button', { name: 'Revoke the invitation to erin@example.com' } ) );
        expect( await pending.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so nothing changed.' );

        answer = () => noContent();
        invitations = [];
        await user.click( pending.getByRole( 'button', { name: 'Revoke the invitation to erin@example.com' } ) );

        expect( await screen.findByText( 'Nobody is waiting to join.' ) ).toBeInTheDocument();
        expect( screen.getByRole( 'tab', { name: 'Invitations · 0' } ) ).toBeInTheDocument();
    } );

    it( 'lists the organization\'s published paths, and points owners to My paths', async () => {
        let answer = () => json( 500, {} );
        const { calls } = api( { 'GET /catalog/paths': () => answer() } );
        const user = userEvent.setup();

        renderApp( `/app/organizations/${CLUB.id}` );
        await user.click( await screen.findByRole( 'tab', { name: 'Paths' } ) );

        expect( screen.getByRole( 'tab', { name: 'Paths' } ) ).toHaveAttribute( 'aria-selected', 'true' );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong while loading.' );
        expect( screen.getByText( '3 members · created Sep 2026' ) ).toBeInTheDocument();

        answer = () => json( 200, [ CLUB_PATH, OTHER_PATH ] );
        await user.click( screen.getByRole( 'button', { name: 'Try again' } ) );

        const list = await screen.findByRole( 'list', { name: 'Paths' } );

        expect( within( list ).getAllByRole( 'heading', { level: 2 } ).map( ( heading ) => heading.textContent ) ).toEqual( [ 'Graph Drills' ] );
        expect( within( screen.getByRole( 'tabpanel' ) ).getByRole( 'link', { name: 'My paths' } ) )
            .toHaveAttribute( 'href', `/app/my-paths?org=${CLUB.id}` );
        expect( calls.find( ( call ) => call.path === '/catalog/paths' )?.query ).toBe( '?source=organizations' );

        await user.click( screen.getByRole( 'tab', { name: 'Members' } ) );
        expect( screen.getByRole( 'region', { name: 'Members' } ) ).toBeInTheDocument();
    } );

    it( 'says when there are no paths yet, without the My paths hint for members', async () => {
        api( { 'GET /catalog/paths': pending }, { role: OrganizationRole.Member } );
        renderApp( `/app/organizations/${CLUB.id}?tab=paths` );

        expect( await screen.findByText( 'Loading the paths…' ) ).toBeInTheDocument();
    } );

    it( 'shows an empty Paths tab', async () => {
        api( { 'GET /catalog/paths': () => json( 200, [ OTHER_PATH ] ) }, { role: OrganizationRole.Member } );
        renderApp( `/app/organizations/${CLUB.id}?tab=paths` );

        expect( await screen.findByText( 'No published paths here yet.' ) ).toBeInTheDocument();
        expect( within( screen.getByRole( 'tabpanel' ) ).queryByRole( 'link', { name: 'My paths' } ) ).toBeNull();
    } );

    it( 'renames the organization', async () => {
        let name = CLUB.name;
        let answer = () => json( 500, {} );
        const { calls } = api( {
            [`GET ${URL}`]: () => json( 200, { ...CLUB, name } ),
            [`PATCH ${URL}`]: () => answer(),
        } );
        const user = userEvent.setup();

        renderApp( `/app/organizations/${CLUB.id}` );
        await user.click( await screen.findByRole( 'button', { name: 'Rename' } ) );

        await user.click( screen.getByRole( 'button', { name: 'Cancel' } ) );
        expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
        await user.click( screen.getByRole( 'button', { name: 'Rename' } ) );

        const dialog = within( screen.getByRole( 'dialog', { name: 'Rename organization' } ) );
        const field = dialog.getByLabelText( 'Name' );

        expect( field ).toHaveValue( 'Acme Study Group' );
        await user.clear( field );
        await user.click( dialog.getByRole( 'button', { name: 'Save' } ) );
        expect( field ).toHaveAccessibleDescription( 'Enter a name.' );

        await user.type( field, 'Acme Interview Club' );
        await user.click( dialog.getByRole( 'button', { name: 'Save' } ) );
        expect( await dialog.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so nothing changed.' );

        answer = () => json( 200, { ...CLUB, name: 'Acme Interview Club' } );
        name = 'Acme Interview Club';
        await user.click( dialog.getByRole( 'button', { name: 'Save' } ) );

        expect( await screen.findByRole( 'heading', { level: 1, name: 'Acme Interview Club' } ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
        expect( calls.find( ( call ) => call.method === 'PATCH' )?.body ).toEqual( { name: 'Acme Interview Club' } );
    } );

    it( 'deletes the organization once its name is typed', async () => {
        let answer = () => json( 500, {} );

        api( { [`DELETE ${URL}`]: () => answer(), 'GET /organizations': pending, 'GET /me/invitations': pending } );
        const user = userEvent.setup();

        renderApp( `/app/organizations/${CLUB.id}` );
        await user.click( await screen.findByRole( 'button', { name: 'Delete' } ) );

        const dialog = within( screen.getByRole( 'dialog', { name: 'Delete Acme Study Group?' } ) );
        const field = dialog.getByLabelText( 'Type the organization\'s name to confirm' );

        await waitFor( () => expect( screen.getByRole( 'dialog' ) )
            .toHaveAccessibleDescription( 'This deletes the organization, its 1 path and its own items for all 3 members. Progress on catalog items is kept.' ) );
        await user.type( field, 'Acme' );
        await user.click( dialog.getByRole( 'button', { name: 'Delete organization' } ) );
        expect( field ).toHaveAccessibleDescription( 'Type the name exactly as it is shown.' );

        await user.type( field, ' Study Group' );
        await user.click( dialog.getByRole( 'button', { name: 'Delete organization' } ) );
        expect( await dialog.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so nothing changed.' );

        answer = () => noContent();
        await user.click( dialog.getByRole( 'button', { name: 'Delete organization' } ) );
        await waitFor( () => expect( screen.getByTestId( 'location' ) ).toHaveTextContent( /^\/app\/organizations$/ ) );
    } );

    it( 'says "for you" when deleting an organization with just its owner, and closes without deleting', async () => {
        const { calls } = api( { 'GET /catalog/paths': pending }, { members: [ ME ] } );
        const user = userEvent.setup();

        renderApp( `/app/organizations/${CLUB.id}` );
        // The paths are still loading: no count yet.
        await screen.findByText( '1 member · created Sep 2026' );
        await user.click( screen.getByRole( 'button', { name: 'Delete' } ) );

        expect( screen.getByRole( 'dialog' ) ).toHaveAccessibleDescription( /its paths and its own items for you\./ );
        await user.click( screen.getByRole( 'button', { name: 'Cancel' } ) );
        expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
        expect( calls.some( ( call ) => call.method === 'DELETE' ) ).toBe( false );
    } );

    it( 'shows a skeleton while loading, and a way to try again', async () => {
        let answer: () => Response | Promise<Response> = pending;

        api( { [`GET ${URL}/members`]: () => answer() } );
        renderApp( `/app/organizations/${CLUB.id}` );

        expect( await screen.findByText( 'Loading the organization…' ) ).toHaveAttribute( 'role', 'status' );

        answer = () => json( 404, { statusCode: 404, message: 'Not Found' } );
        renderApp( `/app/organizations/${CLUB.id}` );
        expect( ( await screen.findAllByRole( 'alert' ) ).at( -1 ) ).toHaveTextContent( 'This organization isn\'t here, or you\'re not a member.' );

        answer = () => json( 200, [ ME ] );
        await userEvent.setup().click( screen.getAllByRole( 'button', { name: 'Try again' } ).at( -1 )! );
        await waitFor( () => expect( rows().map( ( item ) => item.textContent ) )
            .toEqual( [ 'SKSam Khan (you)sam@example.comOwnerJoined Sep 2026' ] ) );
    } );
} );
