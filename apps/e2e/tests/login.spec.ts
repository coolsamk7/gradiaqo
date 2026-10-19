import { expect, failRequests, logIn, OFFLINE, SEEDED, test } from './support/fixtures.ts';

test.describe( 'Login page', () => {
    test.beforeEach( async ( { page } ) => {
        await page.goto( '/login' );
    } );

    test( 'logs in and opens the dashboard', async ( { page } ) => {
        await page.getByLabel( 'Email' ).fill( SEEDED.alice );
        await page.getByLabel( 'Password', { exact: true } ).fill( 'password123' );
        await page.getByRole( 'button', { name: 'Log in' } ).click();

        await expect( page ).toHaveURL( '/app' );
        await expect( page.getByRole( 'heading', { level: 1 } ) ).toHaveText( /, Alice$/ );
    } );

    test( 'accepts the email with spaces around it and in any case', async ( { page } ) => {
        await page.getByLabel( 'Email' ).fill( '  Alice@Example.com ' );
        await page.getByLabel( 'Password', { exact: true } ).fill( 'password123' );
        await page.getByRole( 'button', { name: 'Log in' } ).click();

        await expect( page ).toHaveURL( '/app' );
    } );

    test( 'logs in with the Enter key', async ( { page } ) => {
        await page.getByLabel( 'Email' ).fill( SEEDED.alice );
        await page.getByLabel( 'Password', { exact: true } ).fill( 'password123' );
        await page.getByLabel( 'Password', { exact: true } ).press( 'Enter' );

        await expect( page ).toHaveURL( '/app' );
    } );

    test( 'asks for the email and password before calling the API', async ( { page } ) => {
        await page.getByRole( 'button', { name: 'Log in' } ).click();

        await expect( page.getByText( 'Enter your email.' ) ).toBeVisible();
        await expect( page.getByText( 'Enter your password.' ) ).toBeVisible();
        await expect( page.getByLabel( 'Email' ) ).toBeFocused();
        await expect( page.getByLabel( 'Email' ) ).toHaveAttribute( 'aria-invalid', 'true' );
    } );

    test( 'catches an email that is obviously wrong', async ( { page } ) => {
        await page.getByLabel( 'Email' ).fill( 'alice@' );
        await page.getByLabel( 'Password', { exact: true } ).fill( 'password123' );
        await page.getByRole( 'button', { name: 'Log in' } ).click();

        await expect( page.getByText( 'Enter a valid email, like name@example.com.' ) ).toBeVisible();
        await expect( page ).toHaveURL( '/login' );
    } );

    test( 'says when the email and password don\'t match', async ( { page } ) => {
        await page.getByLabel( 'Email' ).fill( SEEDED.alice );
        await page.getByLabel( 'Password', { exact: true } ).fill( 'not-her-password' );
        await page.getByRole( 'button', { name: 'Log in' } ).click();

        await expect( page.getByRole( 'alert' ) ).toHaveText( 'That email and password don\'t match. Check them and try again.' );
        await expect( page ).toHaveURL( '/login' );
    } );

    test( 'gives the same answer for an email without an account', async ( { page } ) => {
        await page.getByLabel( 'Email' ).fill( 'nobody-here@example.com' );
        await page.getByLabel( 'Password', { exact: true } ).fill( 'password123' );
        await page.getByRole( 'button', { name: 'Log in' } ).click();

        await expect( page.getByRole( 'alert' ) ).toHaveText( 'That email and password don\'t match. Check them and try again.' );
    } );

    test( 'says when StudyLog can\'t be reached', async ( { page } ) => {
        await failRequests( page, '/auth/login' );
        await page.getByLabel( 'Email' ).fill( SEEDED.alice );
        await page.getByLabel( 'Password', { exact: true } ).fill( 'password123' );
        await page.getByRole( 'button', { name: 'Log in' } ).click();

        await expect( page.getByRole( 'alert' ) ).toHaveText( OFFLINE );
        await expect( page.getByRole( 'button', { name: 'Log in' } ) ).toBeEnabled();
    } );

    test( 'shows and hides the password', async ( { page } ) => {
        const password = page.getByLabel( 'Password', { exact: true } );

        await password.fill( 'secret-words' );
        await expect( password ).toHaveAttribute( 'type', 'password' );

        await page.getByRole( 'button', { name: 'Show password' } ).click();
        await expect( password ).toHaveAttribute( 'type', 'text' );
        await expect( page.getByRole( 'button', { name: 'Hide password' } ) ).toHaveAttribute( 'aria-pressed', 'true' );

        await page.getByRole( 'button', { name: 'Hide password' } ).click();
        await expect( password ).toHaveAttribute( 'type', 'password' );
        await expect( password ).toHaveValue( 'secret-words' );
    } );

    test( 'links to the signup page', async ( { page } ) => {
        await page.getByRole( 'link', { name: 'Create an account' } ).click();
        await expect( page ).toHaveURL( '/signup' );
    } );

    test( 'sends someone already logged in straight to the dashboard', async ( { page } ) => {
        await logIn( page, SEEDED.bob );
        await page.goto( '/login' );
        await expect( page ).toHaveURL( '/app' );
    } );
} );
