import type { Page } from '@playwright/test';

import { expect, failRequests, logIn, OFFLINE, SEEDED, test } from './support/fixtures.ts';

/** The value under a stat tile's label, e.g. "Today" → "1h 5m". */
const stat = ( page: Page, label: string ) =>
    page.locator( 'dt', { hasText: new RegExp( `^${label}$` ) } ).locator( 'xpath=following-sibling::dd[1]' );

test.describe( 'Dashboard', () => {
    test( 'greets the user and shows their numbers', async ( { page } ) => {
        await logIn( page, SEEDED.alice );

        await expect( page.getByRole( 'heading', { level: 1 } ) ).toHaveText( /^Good (morning|afternoon|evening), Alice$/ );
        for ( const label of [ 'Today', 'This week', 'Total' ] ) {
            await expect( stat( page, label ) ).toHaveText( /^(\d+h)?\s?(\d+m)?$/ );
        }
        await expect( stat( page, 'Streak' ) ).toHaveText( /^\d+ days?$/ );
        await expect( page.getByText( /^Best: \d+ days?$/ ) ).toBeVisible();
        await expect( stat( page, 'Items completed' ) ).toHaveText( /^[1-9]\d*$/ );
    } );

    test( 'shows the last 30 days as a chart, one bar a day', async ( { page } ) => {
        await logIn( page, SEEDED.alice );

        const chart = page.getByRole( 'region', { name: 'Last 30 days' } );

        await expect( chart.getByRole( 'list', { name: 'Minutes studied per day' } ).getByRole( 'listitem' ) ).toHaveCount( 30 );
        await expect( chart ).toContainText( /\d+h( \d+m)? over \d+ days?\./ );
    } );

    test( 'lists the learning paths with progress and status', async ( { page } ) => {
        await logIn( page, SEEDED.alice );

        const paths = page.getByRole( 'region', { name: 'Your learning paths' } );
        const sprint = paths.getByRole( 'listitem' ).filter( { hasText: 'Interview Sprint' } );
        const dsa = paths.getByRole( 'listitem' ).filter( { hasText: 'Data Structures & Algorithms' } );

        await expect( paths.getByRole( 'listitem' ) ).toHaveCount( 2 );
        await expect( sprint ).toContainText( 'Completed' );
        await expect( sprint ).toContainText( '100%' );
        await expect( sprint.getByRole( 'progressbar', { name: 'Interview Sprint progress' } ) ).toHaveAttribute( 'aria-valuenow', '100' );
        await expect( dsa ).toContainText( /\d+ of \d+ items done/ );
        await expect( dsa ).not.toContainText( 'Completed' );
    } );

    test( 'labels paused paths', async ( { page } ) => {
        await logIn( page, SEEDED.bob );

        const paths = page.getByRole( 'region', { name: 'Your learning paths' } );

        await expect( paths.getByRole( 'listitem' ).filter( { hasText: 'System Design Fundamentals' } ) ).toContainText( 'Paused' );
        await expect( paths.getByRole( 'listitem' ).filter( { hasText: 'Data Structures & Algorithms' } ) ).not.toContainText( 'Paused' );
    } );

    test( 'shows recent sessions and links to all of them', async ( { page } ) => {
        await logIn( page, SEEDED.alice );

        const recent = page.getByRole( 'region', { name: 'Recent sessions' } );

        await expect( recent.getByRole( 'listitem' ).first() ).toBeVisible();
        await recent.getByRole( 'link', { name: /^View all \d+$/ } ).click();
        await expect( page ).toHaveURL( '/app/sessions' );
    } );

    test( 'opens a path from its title', async ( { page } ) => {
        await logIn( page, SEEDED.alice );
        await page.getByRole( 'region', { name: 'Your learning paths' } ).getByRole( 'link', { name: 'Data Structures & Algorithms' } ).click();

        await expect( page ).toHaveURL( /\/app\/paths\/[\da-f-]{36}$/ );
        await expect( page.getByRole( 'heading', { level: 1, name: 'Data Structures & Algorithms' } ) ).toBeVisible();
    } );

    test( '"Log session" opens the session form', async ( { page } ) => {
        await logIn( page, SEEDED.alice );
        await page.getByRole( 'link', { name: 'Log session' } ).click();

        await expect( page ).toHaveURL( '/app/sessions?log' );
        await expect( page.getByRole( 'form', { name: 'Log a study session' } ) ).toBeVisible();
    } );

    test( 'a new user sees empty states and zeros', async ( { page, api } ) => {
        const user = await api.signUp( 'Nova' );

        await logIn( page, user );

        await expect( page.getByRole( 'heading', { level: 1 } ) ).toHaveText( /, Nova$/ );
        await expect( stat( page, 'Today' ) ).toHaveText( '0m' );
        await expect( stat( page, 'This week' ) ).toHaveText( '0m' );
        await expect( stat( page, 'Total' ) ).toHaveText( '0m' );
        await expect( stat( page, 'Streak' ) ).toHaveText( '0 days' );
        await expect( stat( page, 'Items completed' ) ).toHaveText( '0' );
        await expect( page.getByText( 'You aren\'t following any learning paths yet.' ) ).toBeVisible();
        await expect( page.getByText( 'No study time in the last 30 days yet.' ) ).toBeVisible();
        await expect( page.getByText( 'No study sessions yet. Time you log will show up here.' ) ).toBeVisible();
        await expect( page.getByRole( 'link', { name: /^View all/ } ) ).toHaveCount( 0 );
    } );

    test( 'reflects new study time and progress', async ( { page, api } ) => {
        const user = await api.signUp();
        const enrollment = await api.enroll( user, 'Data Structures & Algorithms' );

        await api.logSession( user, enrollment, { topic: 'Two Pointers', item: '3Sum', durationMinutes: 95, notes: 'Sorted first' } );
        await logIn( page, user );

        await expect( stat( page, 'Today' ) ).toHaveText( '1h 35m' );
        await expect( stat( page, 'Total' ) ).toHaveText( '1h 35m' );
        await expect( stat( page, 'Streak' ) ).toHaveText( '1 day' );
        await expect( page.getByText( '1h 35m over 1 day.' ) ).toBeVisible();

        const recent = page.getByRole( 'region', { name: 'Recent sessions' } );

        await expect( recent ).toContainText( '3Sum' );
        await expect( recent ).toContainText( /Two Pointers · Today, \d{1,2}:\d{2} [AP]M/ );
        await expect( recent ).toContainText( 'Sorted first' );
        await expect( recent.getByRole( 'link', { name: 'View all 1' } ) ).toBeVisible();

        const paths = page.getByRole( 'region', { name: 'Your learning paths' } );

        await expect( paths ).toContainText( '0 of 25 items done' );
        await expect( paths ).toContainText( '0%' );
    } );

    test( 'when loading fails, says so and can try again', async ( { page, api } ) => {
        const user = await api.signUp();

        await logIn( page, user );
        const restore = await failRequests( page, '/me/stats*' );

        await page.reload();
        await expect( page.getByRole( 'alert' ) ).toContainText( OFFLINE );

        await restore();
        await page.getByRole( 'button', { name: 'Try again' } ).click();
        await expect( page.getByRole( 'alert' ) ).toHaveCount( 0 );
        await expect( stat( page, 'Today' ) ).toHaveText( '0m' );
    } );
} );
