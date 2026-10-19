import { API_URL } from '../settings.ts';
import { expect, logIn, SEEDED, test } from './support/fixtures.ts';

test.describe( 'Logged-in pages', () => {
    for ( const url of [ '/app', '/app/sessions', '/app/sessions?log', '/app/paths/00000000-0000-4000-8000-000000000000' ] ) {
        test( `${url} sends logged-out visitors to the login page`, async ( { page } ) => {
            await page.goto( url );
            await expect( page ).toHaveURL( '/login' );
            await expect( page.getByRole( 'heading', { name: 'Log in' } ) ).toBeVisible();
        } );
    }

    test( 'after logging in, the visitor lands where they were going', async ( { page } ) => {
        await page.goto( '/app/sessions' );
        await expect( page ).toHaveURL( '/login' );

        await page.getByLabel( 'Email' ).fill( SEEDED.bob );
        await page.getByLabel( 'Password', { exact: true } ).fill( 'password123' );
        await page.getByRole( 'button', { name: 'Log in' } ).click();

        await expect( page ).toHaveURL( '/app/sessions' );
        await expect( page.getByRole( 'heading', { level: 1, name: 'Study sessions' } ) ).toBeVisible();
    } );
} );

test.describe( 'Session', () => {
    test( 'survives a reload, a new tab and going straight to a page', async ( { page, context } ) => {
        await logIn( page, SEEDED.alice );

        await page.reload();
        await expect( page.getByRole( 'heading', { level: 1 } ) ).toHaveText( /, Alice$/ );

        await page.goto( '/app/sessions' );
        await expect( page.getByRole( 'heading', { level: 1, name: 'Study sessions' } ) ).toBeVisible();

        const tab = await context.newPage();

        await tab.goto( '/app' );
        await expect( tab.getByRole( 'heading', { level: 1 } ) ).toHaveText( /, Alice$/ );
    } );

    test( 'shows who is logged in and moves between pages', async ( { page } ) => {
        await logIn( page, SEEDED.alice );

        const header = page.getByRole( 'banner' );
        const nav = header.getByRole( 'navigation', { name: 'Main' } );

        await expect( header ).toContainText( 'Alice Walker' );
        await expect( nav.getByRole( 'link', { name: 'Dashboard' } ) ).toHaveAttribute( 'aria-current', 'page' );

        await nav.getByRole( 'link', { name: 'Sessions' } ).click();
        await expect( page ).toHaveURL( '/app/sessions' );
        await expect( nav.getByRole( 'link', { name: 'Sessions' } ) ).toHaveAttribute( 'aria-current', 'page' );
        await expect( nav.getByRole( 'link', { name: 'Dashboard' } ) ).not.toHaveAttribute( 'aria-current', 'page' );

        await nav.getByRole( 'link', { name: 'Dashboard' } ).click();
        await expect( page ).toHaveURL( '/app' );
    } );

    test( 'the sidebar has every section; Admin only for superadmins; unbuilt ones say "Coming soon"', async ( { page } ) => {
        await logIn( page, SEEDED.alice );
        const main = page.getByRole( 'navigation', { name: 'Main' } );

        await expect( main.getByRole( 'link' ) ).toHaveText( [
            'Dashboard', 'Browse paths', 'Sessions', 'Analytics', 'Interview ready', 'My paths', 'Organizations',
        ] );
        await expect( page.getByRole( 'navigation', { name: 'Admin and settings' } ).getByRole( 'link' ) ).toHaveText( [ 'Settings' ] );

        await main.getByRole( 'link', { name: 'Interview ready' } ).click();
        await expect( page ).toHaveURL( '/app/interview-ready' );
        await expect( page.getByRole( 'heading', { level: 2, name: 'Coming soon' } ) ).toBeVisible();
        await page.getByRole( 'link', { name: 'Back to dashboard' } ).click();
        await expect( page ).toHaveURL( '/app' );

        await page.getByRole( 'button', { name: 'Log out' } ).click();
        await logIn( page, 'admin@example.com' );
        await expect( page.getByRole( 'navigation', { name: 'Admin and settings' } ).getByRole( 'link' ) )
            .toHaveText( [ 'Admin', 'Settings' ] );
    } );

    test( 'logging out goes home and closes the session for good', async ( { page } ) => {
        await logIn( page, SEEDED.alice );
        await page.getByRole( 'button', { name: 'Log out' } ).click();

        await expect( page ).toHaveURL( '/' );
        await page.goto( '/app' );
        await expect( page ).toHaveURL( '/login' );
        // No "session ended" notice: the user chose to leave.
        await expect( page.getByText( 'Your session has ended.' ) ).toHaveCount( 0 );

        await page.reload();
        await expect( page ).toHaveURL( '/login' );
    } );

    test( 'logging out in one tab logs out the others on their next visit', async ( { page, context } ) => {
        await logIn( page, SEEDED.alice );
        const other = await context.newPage();

        await other.goto( '/app' );
        await expect( other.getByRole( 'heading', { level: 1 } ) ).toHaveText( /, Alice$/ );

        await page.getByRole( 'button', { name: 'Log out' } ).click();
        await other.reload();
        await expect( other ).toHaveURL( '/login' );
    } );

    test( 'when the session ends during use, says so and comes back after logging in', async ( { page, context } ) => {
        await logIn( page, SEEDED.alice );
        await page.goto( '/app/sessions' );
        await expect( page.getByRole( 'heading', { level: 1, name: 'Study sessions' } ) ).toBeVisible();

        // The session ends elsewhere: the refresh cookie is gone and the access token no longer works.
        await context.clearCookies();
        await page.route( `${API_URL}/me/**`, ( route ) => route.continue( {
            headers: { ...route.request().headers(), authorization: 'Bearer expired' },
        } ) );

        await page.getByRole( 'navigation', { name: 'Main' } ).getByRole( 'link', { name: 'Dashboard' } ).click();

        await expect( page ).toHaveURL( '/login' );
        await expect( page.getByRole( 'status' ) ).toHaveText( 'Your session has ended. Log in again to continue.' );

        await page.unroute( `${API_URL}/me/**` );
        await page.getByLabel( 'Email' ).fill( SEEDED.alice );
        await page.getByLabel( 'Password', { exact: true } ).fill( 'password123' );
        await page.getByRole( 'button', { name: 'Log in' } ).click();
        await expect( page ).toHaveURL( '/app' );
    } );
} );
