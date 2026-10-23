import type { Page } from '@playwright/test';

import { expect, logIn, test } from './support/fixtures.ts';

const SYSTEM = 'System Design Fundamentals';

/** From Browse paths to the preview of a path. */
async function openPreview( page: Page, title: string ) {
    await page.getByRole( 'navigation', { name: 'Main' } ).getByRole( 'link', { name: 'Browse paths' } ).click();
    await page.getByRole( 'link', { name: `View ${title}` } ).click();
    await expect( page ).toHaveURL( /\/app\/catalog\/[\da-f-]{36}$/ );
    await expect( page.getByRole( 'heading', { level: 1, name: title } ) ).toBeVisible();
}

test.describe( 'Enrolling and path settings', () => {
    // A new user each time: these tests enroll, pause and leave.
    test( 'previews a path, enrolls in the whole of it, and finds it on the dashboard', async ( { page, api } ) => {
        await logIn( page, await api.signUp() );
        await openPreview( page, SYSTEM );

        await expect( page.getByRole( 'region', { name: 'Foundations' } ) ).toContainText( '2 topics' );
        await expect( page.getByRole( 'region', { name: 'About' } ) ).toContainText( 'Official catalog' );

        await page.getByRole( 'button', { name: 'Enroll' } ).first().click();
        await expect( page ).toHaveURL( /\/app\/paths\/[\da-f-]{36}$/ );
        await expect( page.getByRole( 'heading', { level: 1, name: SYSTEM } ) ).toBeVisible();

        await page.getByRole( 'navigation', { name: 'Main' } ).getByRole( 'link', { name: 'Dashboard' } ).click();
        await expect( page.getByRole( 'region', { name: 'Your learning paths' } ) ).toContainText( SYSTEM );

        // The catalog now offers to continue it.
        await page.getByRole( 'navigation', { name: 'Main' } ).getByRole( 'link', { name: 'Browse paths' } ).click();
        await expect( page.getByRole( 'link', { name: `Continue ${SYSTEM}` } ) ).toBeVisible();
    } );

    test( 'enrolls in chosen parts, then changes them, pauses and leaves in Path settings', async ( { page, api } ) => {
        await logIn( page, await api.signUp() );
        await openPreview( page, SYSTEM );

        await page.getByRole( 'button', { name: 'Choose parts' } ).first().click();
        let dialog = page.getByRole( 'dialog', { name: 'Choose what to follow' } );

        await dialog.getByRole( 'checkbox', { name: /^Data at Scale/ } ).uncheck();
        await expect( dialog.getByRole( 'checkbox', { name: /^Consistency/ } ) ).not.toBeChecked();
        await dialog.getByRole( 'button', { name: 'Enroll' } ).click();

        await expect( page ).toHaveURL( /\/app\/paths\/[\da-f-]{36}$/ );
        await expect( page.getByRole( 'heading', { level: 2 } ) ).toHaveText( [ 'Foundations' ] );

        await page.getByRole( 'link', { name: 'Path settings' } ).click();
        await expect( page ).toHaveURL( /\/settings$/ );
        const parts = page.getByRole( 'region', { name: 'What you follow' } );

        await expect( parts ).toContainText( 'Data at Scale is left out.' );

        // Follow everything after all.
        await parts.getByRole( 'button', { name: 'Edit parts' } ).click();
        dialog = page.getByRole( 'dialog', { name: 'Choose what to follow' } );
        await dialog.getByRole( 'checkbox', { name: /^Data at Scale/ } ).check();
        await dialog.getByRole( 'button', { name: 'Save' } ).click();
        await expect( parts ).toContainText( 'The whole path' );

        // Pause, then resume.
        const status = page.getByRole( 'region', { name: 'Status' } );

        await status.getByRole( 'button', { name: 'Pause' } ).click();
        await expect( status ).toContainText( 'Paused' );
        await status.getByRole( 'button', { name: 'Resume' } ).click();
        await expect( status ).toContainText( 'Active' );

        // Leave: back on the dashboard, without the path.
        await page.getByRole( 'region', { name: 'Leave this path' } ).getByRole( 'button', { name: 'Leave path' } ).click();
        await page.getByRole( 'dialog', { name: `Leave ${SYSTEM}?` } ).getByRole( 'button', { name: 'Leave path' } ).click();
        await expect( page ).toHaveURL( '/app' );
        await expect( page.getByText( 'Welcome to StudyLog. Pick a learning path to get started.' ) ).toBeVisible();
    } );
} );
