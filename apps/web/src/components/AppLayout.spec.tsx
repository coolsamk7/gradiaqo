import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, loggedIn, mockApi, pending, USER } from '../test/api.ts';
import { renderApp } from '../test/render.tsx';

/** A logged-in user whose pages never finish loading: these tests are only about the frame around them. */
function api() {
    return mockApi( {
        ...loggedIn,
        'GET /me/stats': pending,
        'GET /me/enrollments': pending,
        'GET /me/enrollments/e1': pending,
        'GET /me/study-sessions': pending,
    } );
}

describe( 'AppLayout', () => {
    it( 'marks the section of the current page, and a path page belongs to the dashboard', async () => {
        api();
        renderApp( '/app/paths/e1' );

        const nav = within( await screen.findByRole( 'navigation', { name: 'Main' } ) );

        expect( nav.getByRole( 'link', { name: 'Dashboard' } ) ).toHaveAttribute( 'aria-current', 'page' );
        expect( nav.getByRole( 'link', { name: 'Sessions' } ) ).not.toHaveAttribute( 'aria-current' );
        expect( screen.getByRole( 'link', { name: 'StudyLog dashboard' } ) ).toHaveAttribute( 'href', '/app' );
    } );

    it( 'opens and closes the menu on small screens, and closes it after choosing a page', async () => {
        api();
        renderApp( '/app' );
        const user = userEvent.setup();
        const toggle = await screen.findByRole( 'button', { name: 'Open menu' } );

        expect( toggle ).toHaveAttribute( 'aria-expanded', 'false' );
        expect( toggle ).toHaveAttribute( 'aria-controls', 'app-menu' );

        await user.click( toggle );
        expect( screen.getByRole( 'button', { name: 'Close menu' } ) ).toHaveAttribute( 'aria-expanded', 'true' );

        await user.click( screen.getByRole( 'button', { name: 'Close menu' } ) );
        expect( screen.getByRole( 'button', { name: 'Open menu' } ) ).toHaveAttribute( 'aria-expanded', 'false' );

        await user.click( screen.getByRole( 'button', { name: 'Open menu' } ) );
        await user.click( screen.getByRole( 'link', { name: 'Sessions' } ) );
        expect( screen.getByTestId( 'location' ) ).toHaveTextContent( '/app/sessions' );
        expect( screen.getByRole( 'button', { name: 'Open menu' } ) ).toHaveAttribute( 'aria-expanded', 'false' );
    } );

    it( 'lists every section of the app, with Admin only for superadmins', async () => {
        api();
        const { unmount } = renderApp( '/app' );
        const main = within( await screen.findByRole( 'navigation', { name: 'Main' } ) );

        expect( main.getAllByRole( 'link' ).map( ( link ) => [ link.textContent, link.getAttribute( 'href' ) ] ) ).toEqual( [
            [ 'Dashboard', '/app' ],
            [ 'Browse paths', '/app/catalog' ],
            [ 'Sessions', '/app/sessions' ],
            [ 'Analytics', '/app/analytics' ],
            [ 'Interview ready', '/app/interview-ready' ],
            [ 'My paths', '/app/my-paths' ],
            [ 'Organizations', '/app/organizations' ],
        ] );
        expect( within( screen.getByRole( 'navigation', { name: 'Admin and settings' } ) ).getAllByRole( 'link' )
            .map( ( link ) => link.textContent ) ).toEqual( [ 'Settings' ] );
        unmount();

        mockApi( { ...loggedIn, 'GET /auth/me': () => json( 200, { ...USER, platformRole: 'superadmin' } ), 'GET /me/stats': pending, 'GET /me/enrollments': pending, 'GET /me/study-sessions': pending } );
        renderApp( '/app' );

        const more = within( await screen.findByRole( 'navigation', { name: 'Admin and settings' } ) );

        expect( more.getAllByRole( 'link' ).map( ( link ) => [ link.textContent, link.getAttribute( 'href' ) ] ) )
            .toEqual( [ [ 'Admin', '/app/admin' ], [ 'Settings', '/app/settings' ] ] );
    } );

    it( 'opens a section that isn\'t built yet on a "coming soon" page, marked as current', async () => {
        api();
        renderApp( '/app' );
        await userEvent.setup().click( await screen.findByRole( 'link', { name: 'Analytics' } ) );

        expect( screen.getByTestId( 'location' ) ).toHaveTextContent( '/app/analytics' );
        expect( screen.getByRole( 'heading', { level: 1, name: 'Analytics' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'heading', { level: 2, name: 'Coming soon' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'link', { name: 'Analytics' } ) ).toHaveAttribute( 'aria-current', 'page' );
        expect( screen.getByRole( 'link', { name: 'Back to dashboard' } ) ).toHaveAttribute( 'href', '/app' );
    } );
} );
