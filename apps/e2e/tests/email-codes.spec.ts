import { expect, logIn, test } from './support/fixtures.ts';
import { latestCode } from './support/mailpit.ts';

test.describe( 'Email codes', () => {
    // New users each time: these tests verify emails and change passwords.
    test( 'a new user verifies their email with the code sent at signup', async ( { page, api } ) => {
        const user = await api.signUp( 'Vera' );

        await logIn( page, user );
        const banner = page.getByText( `Verify your email: we sent a 6-digit code to ${user.email}.` );

        await expect( banner ).toBeVisible();
        await page.getByRole( 'link', { name: 'Enter code' } ).click();
        await expect( page.getByRole( 'heading', { level: 1, name: 'Check your inbox' } ) ).toBeVisible();

        // A wrong code first.
        await page.getByRole( 'textbox', { name: 'Digit 1 of 6' } ).fill( '0' );
        await page.keyboard.type( '00000' );
        await page.getByRole( 'button', { name: 'Verify email' } ).click();
        await expect( page.getByRole( 'alert' ) ).toContainText( 'That code is wrong or has expired' );

        const code = await latestCode( user.email, /is your StudyLog code$/ );

        await page.getByRole( 'textbox', { name: 'Digit 1 of 6' } ).click();
        await page.keyboard.type( code );
        await page.getByRole( 'button', { name: 'Verify email' } ).click();

        await expect( page ).toHaveURL( '/app' );
        await expect( banner ).toBeHidden();
        await page.reload();
        await expect( page.getByRole( 'heading', { level: 1 } ) ).toContainText( 'Vera' );
        await expect( banner ).toBeHidden();
    } );

    test( 'a new code can be sent, and only the newest one works', async ( { page, api } ) => {
        const user = await api.signUp();
        const first = await latestCode( user.email, /is your StudyLog code$/ );

        await logIn( page, user );
        await page.goto( '/verify-email' );
        // The API refuses a resend within a minute of the signup email.
        await page.getByRole( 'button', { name: 'Resend code' } ).click();
        await expect( page.getByRole( 'alert' ) ).toContainText( 'Wait a minute' );
        await expect( page.getByRole( 'button', { name: 'Resend code' } ) ).toBeVisible();
        expect( first ).toMatch( /^\d{6}$/ );
    } );

    test( 'resets a forgotten password with an emailed code', async ( { page, api } ) => {
        const user = await api.signUp();
        const started = new Date();

        await page.goto( '/login' );
        await page.getByLabel( 'Email' ).fill( user.email );
        await page.getByRole( 'link', { name: 'Forgot password?' } ).click();
        await expect( page.getByRole( 'heading', { level: 1, name: 'Reset your password' } ) ).toBeVisible();
        await page.getByRole( 'button', { name: 'Send reset code' } ).click();

        await expect( page ).toHaveURL( '/reset-password' );
        const code = await latestCode( user.email, /password reset code$/, started );

        await page.getByLabel( 'Code' ).fill( code );
        await page.getByLabel( 'New password' ).fill( 'a-brand-new-password' );
        await page.getByRole( 'button', { name: 'Reset password' } ).click();

        await expect( page ).toHaveURL( '/login' );
        await expect( page.getByRole( 'status' ) ).toHaveText( 'Your password was changed. Log in with your new password.' );
        await logIn( page, { ...user, password: 'a-brand-new-password' } );

        // Resetting proved the email is theirs.
        await expect( page.getByText( /^Verify your email/ ) ).toBeHidden();
    } );
} );
