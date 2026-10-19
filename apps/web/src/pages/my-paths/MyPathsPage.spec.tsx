import type { LearningPathJson } from '@studylog/schemas';
import { OrganizationRole, PathVisibility } from '@studylog/schemas/enums';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, loggedIn, mockApi, pending } from '../../test/api.ts';
import { organization, pathTree, uuid } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';

const WORKSPACE = organization();
const ACME = organization( { id: uuid( 5 ), name: 'Acme Study Group', isPersonal: false, role: OrganizationRole.Admin } );
const BOOK_CLUB = organization( { id: uuid( 6 ), name: 'Book Club', isPersonal: false, role: OrganizationRole.Member } );

const daysAgo = ( days: number ) => new Date( Date.now() - days * 86_400_000 ).toISOString();

/** A path as the list returns it (no modules). */
function listed( title: string, overrides: Partial<LearningPathJson> = {} ): LearningPathJson {
    const { modules: _modules, ...path } = pathTree( title, [], overrides );

    return path;
}

const FAVOURITES = listed( 'Favourite Problems', { id: uuid( 401 ), visibility: PathVisibility.Public, updatedAt: daysAgo( 0 ) } );
const NOTES = listed( 'System Design Notes', { id: uuid( 402 ), updatedAt: daysAgo( 1 ) } );
const TEAM = listed( 'Team Drills', { id: uuid( 403 ), organizationId: ACME.id, updatedAt: '2026-08-05T12:00:00.000Z' } );

function api( handlers: Record<string, () => Response | Promise<Response>> = {} ) {
    return mockApi( {
        ...loggedIn,
        'GET /organizations': () => json( 200, [ BOOK_CLUB, ACME, WORKSPACE ] ),
        [`GET /organizations/${WORKSPACE.id}/catalog/paths`]: () => json( 200, [ FAVOURITES, NOTES ] ),
        [`GET /organizations/${ACME.id}/catalog/paths`]: () => json( 200, [ TEAM ] ),
        ...handlers,
    } );
}

const row = ( title: string ) => within( screen.getByRole( 'heading', { level: 2, name: title } ).closest( 'li' )! );

describe( 'MyPathsPage', () => {
    it( 'lists the paths in the user\'s workspace, with who can see them and a way to edit each', async () => {
        api();
        renderApp( '/app/my-paths' );

        expect( await screen.findByRole( 'heading', { level: 2, name: 'Favourite Problems' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'heading', { level: 1, name: 'My paths' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'link', { name: 'My paths' } ) ).toHaveAttribute( 'aria-current', 'page' );
        expect( screen.getByText( /Private paths are only for you/ ) ).toBeInTheDocument();
        // The workspace first; organizations where the user is only a member can't be edited.
        expect( within( screen.getByRole( 'group', { name: 'Where' } ) ).getAllByRole( 'button' ).map( ( tab ) => tab.textContent ) )
            .toEqual( [ 'Your workspace', 'Acme Study Group' ] );
        expect( screen.getByRole( 'button', { name: 'Your workspace' } ) ).toHaveAttribute( 'aria-pressed', 'true' );

        expect( row( 'Favourite Problems' ).getByText( 'Public' ) ).toBeInTheDocument();
        expect( row( 'Favourite Problems' ).getByText( 'Updated today' ) ).toBeInTheDocument();
        expect( row( 'System Design Notes' ).getByText( 'Private' ) ).toBeInTheDocument();
        expect( row( 'System Design Notes' ).getByText( 'Updated yesterday' ) ).toBeInTheDocument();
        expect( screen.getByRole( 'link', { name: 'Edit Favourite Problems' } ) )
            .toHaveAttribute( 'href', `/app/my-paths/${WORKSPACE.id}/${uuid( 401 )}` );
    } );

    it( 'shows the paths of an organization the user runs, kept in the URL', async () => {
        const { calls } = api();
        const user = userEvent.setup();

        renderApp( '/app/my-paths' );
        await user.click( await screen.findByRole( 'button', { name: 'Acme Study Group' } ) );

        expect( await screen.findByRole( 'heading', { level: 2, name: 'Team Drills' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'list', { name: 'Paths in Acme Study Group' } ) ).toBeInTheDocument();
        expect( screen.getByText( /for the members of Acme Study Group/ ) ).toBeInTheDocument();
        expect( row( 'Team Drills' ).getByText( 'Updated Wed, Aug 5' ) ).toBeInTheDocument();
        // Organization paths are for members only: no public or private.
        expect( row( 'Team Drills' ).queryByText( 'Private' ) ).not.toBeInTheDocument();
        expect( calls.some( ( call ) => call.path === `/organizations/${BOOK_CLUB.id}/catalog/paths` ) ).toBe( false );

        await user.click( screen.getByRole( 'button', { name: 'Your workspace' } ) );
        expect( await screen.findByRole( 'heading', { level: 2, name: 'Favourite Problems' } ) ).toBeInTheDocument();
    } );

    it( 'opens the organization in the URL; an unknown one falls back to the workspace', async () => {
        api();
        const first = renderApp( `/app/my-paths?org=${ACME.id}` );

        expect( await screen.findByRole( 'heading', { level: 2, name: 'Team Drills' } ) ).toBeInTheDocument();
        first.unmount();

        renderApp( `/app/my-paths?org=${BOOK_CLUB.id}` );
        expect( await screen.findByRole( 'heading', { level: 2, name: 'Favourite Problems' } ) ).toBeInTheDocument();
    } );

    it( 'without organizations to run, has no tabs; with no paths, says so', async () => {
        api( { 'GET /organizations': () => json( 200, [ WORKSPACE ] ), [`GET /organizations/${WORKSPACE.id}/catalog/paths`]: () => json( 200, [] ) } );
        renderApp( '/app/my-paths' );

        expect( await screen.findByRole( 'heading', { level: 2, name: 'No paths here yet' } ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'group', { name: 'Where' } ) ).not.toBeInTheDocument();
    } );

    it( 'shows loading, and when loading fails, says so and can try again', async () => {
        let organizations: () => Response | Promise<Response> = pending;
        let paths: () => Response | Promise<Response> = () => json( 500, { statusCode: 500, message: 'boom' } );

        api( { 'GET /organizations': () => organizations(), [`GET /organizations/${WORKSPACE.id}/catalog/paths`]: () => paths() } );
        const first = renderApp( '/app/my-paths' );

        expect( await screen.findByText( 'Loading your paths…' ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'button', { name: 'New path' } ) ).not.toBeInTheDocument();
        first.unmount();

        organizations = () => Promise.reject( new TypeError( 'offline' ) );
        renderApp( '/app/my-paths' );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach StudyLog right now.' );

        organizations = () => json( 200, [ WORKSPACE ] );
        await userEvent.setup().click( screen.getByRole( 'button', { name: 'Try again' } ) );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong while loading.' );

        paths = () => json( 200, [ NOTES ] );
        await userEvent.setup().click( screen.getByRole( 'button', { name: 'Try again' } ) );
        expect( await screen.findByRole( 'heading', { level: 2, name: 'System Design Notes' } ) ).toBeInTheDocument();
    } );

    describe( 'New path', () => {
        it( 'creates a path in the workspace, public if asked, and opens it in the builder', async () => {
            const { calls } = api( {
                [`POST /organizations/${WORKSPACE.id}/catalog/paths`]: () => json( 201, listed( 'Graphs', { id: uuid( 409 ) } ) ),
                [`GET /organizations/${WORKSPACE.id}/catalog/paths/${uuid( 409 )}`]: pending,
                [`GET /organizations/${WORKSPACE.id}`]: pending,
            } );
            const user = userEvent.setup();

            renderApp( '/app/my-paths' );
            await user.click( await screen.findByRole( 'button', { name: 'New path' } ) );

            const dialog = within( screen.getByRole( 'dialog', { name: 'New path' } ) );

            expect( screen.getByRole( 'dialog' ) ).toHaveAccessibleDescription( 'In your workspace.' );
            expect( dialog.getByLabelText( 'Title' ) ).toHaveFocus();
            expect( dialog.getByLabelText( 'Private: only you' ) ).toBeChecked();

            await user.click( dialog.getByRole( 'button', { name: 'Create path' } ) );
            expect( dialog.getByText( 'Enter a title.' ) ).toBeInTheDocument();
            expect( dialog.getByLabelText( 'Title' ) ).toHaveFocus();

            await user.type( dialog.getByLabelText( 'Title' ), ' Graphs ' );
            await user.type( dialog.getByLabelText( 'Description (optional)' ), 'BFS, DFS and friends' );
            await user.click( dialog.getByLabelText( /^Public/ ) );
            await user.click( dialog.getByLabelText( 'Private: only you' ) );
            await user.click( dialog.getByLabelText( /^Public/ ) );
            await user.click( dialog.getByRole( 'button', { name: 'Create path' } ) );

            await waitFor( () => expect( screen.getByTestId( 'location' ) )
                .toHaveTextContent( `/app/my-paths/${WORKSPACE.id}/${uuid( 409 )}` ) );
            expect( calls.find( ( call ) => call.path.endsWith( '/catalog/paths' ) && call.method === 'POST' )?.body )
                .toEqual( { title: 'Graphs', description: 'BFS, DFS and friends', visibility: PathVisibility.Public } );
        } );

        it( 'in an organization, has no visibility to choose and leaves out an empty description', async () => {
            const { calls } = api( {
                [`POST /organizations/${ACME.id}/catalog/paths`]: () => json( 201, TEAM ),
                [`GET /organizations/${ACME.id}/catalog/paths/${TEAM.id}`]: pending,
                [`GET /organizations/${ACME.id}`]: pending,
            } );
            const user = userEvent.setup();

            renderApp( `/app/my-paths?org=${ACME.id}` );
            await user.click( await screen.findByRole( 'button', { name: 'New path' } ) );
            expect( screen.getByRole( 'dialog' ) ).toHaveAccessibleDescription( 'In Acme Study Group.' );
            expect( screen.queryByText( 'Who can see it' ) ).not.toBeInTheDocument();

            await user.type( screen.getByLabelText( 'Title' ), 'Team Drills' );
            await user.click( screen.getByRole( 'button', { name: 'Create path' } ) );

            await waitFor( () => expect( calls.find( ( call ) => call.path.endsWith( '/catalog/paths' ) && call.method === 'POST' )?.body )
                .toEqual( { title: 'Team Drills' } ) );
        } );

        it( 'explains a title that\'s taken, and can be closed with Cancel, × or Escape', async () => {
            let answer: () => Response | Promise<Response> = () => json( 409, { statusCode: 409, message: 'taken' } );

            api( { [`POST /organizations/${WORKSPACE.id}/catalog/paths`]: () => answer() } );
            const user = userEvent.setup();

            renderApp( '/app/my-paths' );
            const open = await screen.findByRole( 'button', { name: 'New path' } );

            await user.click( open );
            await user.type( screen.getByLabelText( 'Title' ), 'Favourite Problems' );
            await user.click( screen.getByRole( 'button', { name: 'Create path' } ) );
            expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'You already have a path with this title. Try another.' );
            expect( screen.getByRole( 'button', { name: 'Create path' } ) ).toBeEnabled();

            answer = pending;
            await user.click( screen.getByRole( 'button', { name: 'Create path' } ) );
            expect( screen.getByRole( 'button', { name: 'Creating…' } ) ).toBeDisabled();

            await user.click( screen.getByRole( 'button', { name: 'Cancel' } ) );
            expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
            // Focus goes back to the button that opened it.
            expect( open ).toHaveFocus();

            await user.click( open );
            await user.click( screen.getByRole( 'button', { name: 'Close' } ) );
            expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();

            await user.click( open );
            await user.keyboard( 'a' );
            expect( screen.getByRole( 'dialog' ) ).toBeInTheDocument();
            await user.keyboard( '{Escape}' );
            expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
        } );
    } );
} );
