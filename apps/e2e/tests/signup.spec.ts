import { randomUUID } from 'node:crypto';

import type { Page } from '@playwright/test';

import { expect, logIn, SEEDED, test } from './support/fixtures.ts';

const uniqueEmail = () => `signup-${randomUUID()}@example.com`;

type Details = Partial<Record<'firstName' | 'lastName' | 'email' | 'password', string>>;

async function fillForm( page: Page, details: Details ) {
    await page.getByLabel( 'First name' ).fill( details.firstName ?? '' );
    await page.getByLabel( 'Last name' ).fill( details.lastName ?? '' );
    await page.getByLabel( 'Email' ).fill( details.email ?? '' );
    await page.getByLabel( 'Password', { exact: true } ).fill( details.password ?? '' );
    await page.getByRole( 'button', { name: 'Create account' } ).click();
}

test.describe( 'Signup page', () => {
    test.beforeEach( async ( { page } ) => {
        await page.goto( '/signup' );
    } );

    test( 'creates an account, logs in, and shows an empty dashboard', async ( { page } ) => {
        await fillForm( page, { firstName: '  Erin ', lastName: 'Example', email: uniqueEmail(), password: 'a-long-enough-password' } );

        await expect( page ).toHaveURL( '/app' );
        await expect( page.getByRole( 'heading', { level: 1 } ) ).toHaveText( /, Erin$/ );
        await expect( page.getByRole( 'banner' ) ).toContainText( 'Erin Example' );
        await expect( page.getByText( 'You aren\'t following any learning paths yet.' ) ).toBeVisible();
    } );

    test( 'the new account can log in again later', async ( { page } ) => {
        const email = uniqueEmail();

        await fillForm( page, { firstName: 'Finn', lastName: 'Example', email, password: 'another-good-password' } );
        await expect( page ).toHaveURL( '/app' );
        await page.getByRole( 'button', { name: 'Log out' } ).click();
        await expect( page ).toHaveURL( '/' );

        await logIn( page, { email, password: 'another-good-password', firstName: 'Finn', lastName: 'Example', token: '' } );
        await expect( page.getByRole( 'heading', { level: 1 } ) ).toHaveText( /, Finn$/ );
    } );

    test( 'explains every missing field and focuses the first one', async ( { page } ) => {
        await fillForm( page, {} );

        await expect( page.getByText( 'Enter your first name.' ) ).toBeVisible();
        await expect( page.getByText( 'Enter your last name.' ) ).toBeVisible();
        await expect( page.getByText( 'Enter your email.' ) ).toBeVisible();
        await expect( page.getByText( 'Create a password.' ) ).toBeVisible();
        await expect( page.getByLabel( 'First name' ) ).toBeFocused();
        await expect( page ).toHaveURL( '/signup' );
    } );

    test( 'treats names made of spaces as missing', async ( { page } ) => {
        await fillForm( page, { firstName: '   ', lastName: 'Example', email: uniqueEmail(), password: 'a-long-enough-password' } );

        await expect( page.getByText( 'Enter your first name.' ) ).toBeVisible();
    } );

    test( 'checks the email and the password length', async ( { page } ) => {
        await expect( page.getByText( 'At least 8 characters.' ) ).toBeVisible();

        await fillForm( page, { firstName: 'Gil', lastName: 'Example', email: 'gil@example', password: 'short' } );

        await expect( page.getByText( 'Enter a valid email, like name@example.com.' ) ).toBeVisible();
        await expect( page.getByText( 'Use at least 8 characters.' ) ).toBeVisible();
        await expect( page.getByLabel( 'Email' ) ).toBeFocused();
    } );

    test( 'rejects names and passwords that are too long', async ( { page } ) => {
        await fillForm( page, { firstName: 'x'.repeat( 101 ), lastName: 'Example', email: uniqueEmail(), password: 'p'.repeat( 129 ) } );

        await expect( page.getByText( 'First name must be 100 characters or fewer.' ) ).toBeVisible();
        await expect( page.getByText( 'Use 128 characters or fewer.' ) ).toBeVisible();
    } );

    test( 'offers to log in when the email already has an account', async ( { page } ) => {
        await fillForm( page, { firstName: 'Alice', lastName: 'Again', email: SEEDED.alice, password: 'a-long-enough-password' } );

        await expect( page.getByText( 'An account with this email already exists.' ) ).toBeVisible();
        await expect( page.getByLabel( 'Email' ) ).toBeFocused();

        await page.getByRole( 'link', { name: 'Log in instead' } ).click();
        await expect( page ).toHaveURL( '/login' );
        await expect( page.getByLabel( 'Email' ) ).toHaveValue( SEEDED.alice );
    } );

    test( 'shows and hides the password', async ( { page } ) => {
        await page.getByLabel( 'Password', { exact: true } ).fill( 'my-new-password' );
        await page.getByRole( 'button', { name: 'Show password' } ).click();
        await expect( page.getByLabel( 'Password', { exact: true } ) ).toHaveAttribute( 'type', 'text' );
    } );

    test( 'links to the login page', async ( { page } ) => {
        await page.getByRole( 'link', { name: 'Log in', exact: true } ).click();
        await expect( page ).toHaveURL( '/login' );
    } );

    test( 'after signing up, continues to the page the visitor first asked for', async ( { page } ) => {
        await page.goto( '/app/sessions' );
        await expect( page ).toHaveURL( '/login' );
        await page.getByRole( 'link', { name: 'Create an account' } ).click();
        await expect( page ).toHaveURL( '/signup' );

        await fillForm( page, { firstName: 'Hana', lastName: 'Example', email: uniqueEmail(), password: 'a-long-enough-password' } );

        await expect( page ).toHaveURL( '/app/sessions' );
        await expect( page.getByRole( 'heading', { level: 1, name: 'Study sessions' } ) ).toBeVisible();
    } );

    test( 'sends someone already logged in straight to the dashboard', async ( { page } ) => {
        await logIn( page, SEEDED.bob );
        await page.goto( '/signup' );
        await expect( page ).toHaveURL( '/app' );
    } );
} );
