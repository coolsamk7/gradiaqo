import { expect, logIn, test } from './support/fixtures.ts';

test.describe( 'Account settings', () => {
    // A new user each time: these tests change the account, and delete it.
    test( 'renames the user, changes the password, then logs in with the new one', async ( { page, api } ) => {
        const user = await api.signUp( 'Tess' );

        await logIn( page, user );
        await page.getByRole( 'navigation', { name: 'Admin and settings' } ).getByRole( 'link', { name: 'Settings' } ).click();
        await expect( page ).toHaveURL( '/app/settings' );

        const profile = page.getByRole( 'region', { name: 'Profile' } );

        await expect( profile.getByLabel( 'Email' ) ).toHaveValue( user.email );
        await profile.getByLabel( 'First name' ).fill( 'Theresa' );
        await profile.getByRole( 'button', { name: 'Save changes' } ).click();
        await expect( profile.getByRole( 'status' ) ).toHaveText( 'Saved.' );
        await expect( page.getByText( 'Theresa Tester' ) ).toHaveCount( 2 );

        const password = page.getByRole( 'region', { name: 'Password' } );

        await password.getByLabel( 'Current password' ).fill( 'not-my-password' );
        await password.getByLabel( 'New password' ).fill( 'a-new-password' );
        await password.getByRole( 'button', { name: 'Update password' } ).click();
        await expect( password.getByText( 'That isn\'t your current password.' ) ).toBeVisible();

        await password.getByLabel( 'Current password' ).fill( user.password );
        await password.getByRole( 'button', { name: 'Update password' } ).click();
        await expect( password.getByRole( 'status' ) ).toContainText( 'Password changed.' );

        await page.getByRole( 'button', { name: 'Log out' } ).click();
        await logIn( page, { ...user, password: 'a-new-password' } );
        await expect( page.getByRole( 'heading', { level: 1 } ) ).toContainText( 'Theresa' );
    } );

    test( 'deletes the account, after the password', async ( { page, api } ) => {
        const user = await api.signUp();

        await logIn( page, user );
        await page.goto( '/app/settings' );
        await page.getByRole( 'button', { name: 'Delete account' } ).click();

        const dialog = page.getByRole( 'dialog', { name: 'Delete your account?' } );

        await dialog.getByLabel( 'Password', { exact: true } ).fill( 'wrong-password' );
        await dialog.getByRole( 'button', { name: 'Delete account' } ).click();
        await expect( dialog.getByText( 'That isn\'t your password.' ) ).toBeVisible();

        await dialog.getByLabel( 'Password', { exact: true } ).fill( user.password );
        await dialog.getByRole( 'button', { name: 'Delete account' } ).click();
        await expect( page ).toHaveURL( '/' );

        // The account is gone.
        await page.goto( '/login' );
        await page.getByLabel( 'Email' ).fill( user.email );
        await page.getByLabel( 'Password', { exact: true } ).fill( user.password );
        await page.getByRole( 'button', { name: 'Log in' } ).click();
        await expect( page.getByRole( 'alert' ) ).toBeVisible();
        await expect( page ).toHaveURL( '/login' );
    } );

    test( 'follows the system theme, and remembers a chosen one', async ( { page, api } ) => {
        const html = page.locator( 'html' );
        const user = await api.signUp();

        await page.emulateMedia( { colorScheme: 'dark' } );
        await logIn( page, user );
        await expect( html ).toHaveAttribute( 'data-theme', 'dark' );
        await page.emulateMedia( { colorScheme: 'light' } );
        await expect( html ).toHaveAttribute( 'data-theme', 'light' );

        await page.goto( '/app/settings' );
        const themes = page.getByRole( 'group', { name: 'Theme' } );

        await expect( themes.getByRole( 'button', { name: 'System' } ) ).toHaveAttribute( 'aria-pressed', 'true' );
        await themes.getByRole( 'button', { name: 'Dark' } ).click();
        await expect( html ).toHaveAttribute( 'data-theme', 'dark' );
        await expect( html ).toHaveCSS( 'background-color', 'rgb(14, 14, 12)' );

        // Set before the app loads, so the page doesn't flash light.
        await page.reload();
        await expect( html ).toHaveAttribute( 'data-theme', 'dark' );
        await expect( themes.getByRole( 'button', { name: 'Dark' } ) ).toHaveAttribute( 'aria-pressed', 'true' );

        await themes.getByRole( 'button', { name: 'System' } ).click();
        await expect( html ).toHaveAttribute( 'data-theme', 'light' );
    } );
} );
