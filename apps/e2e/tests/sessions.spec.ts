import type { Page } from '@playwright/test';

import { expect, failRequests, logIn, OFFLINE, SEEDED, test } from './support/fixtures.ts';

const DSA = 'Data Structures & Algorithms';

const logForm = ( page: Page ) => page.getByRole( 'form', { name: 'Log a study session' } );
const selected = ( page: Page, label: string ) => logForm( page ).getByLabel( label ).locator( 'option:checked' );

/** Opens the sessions page as a new user enrolled in the DSA path. */
async function asLearner( page: Page, api: import( './support/api.ts' ).Api ) {
    const user = await api.signUp();
    const enrollment = await api.enroll( user, DSA );

    await logIn( page, user );

    return { user, enrollment };
}

test.describe( 'Study history', () => {
    test( 'groups sessions by day, newest first, with daily totals, and loads more on request', async ( { page } ) => {
        await logIn( page, SEEDED.alice );
        await page.getByRole( 'navigation', { name: 'Main' } ).getByRole( 'link', { name: 'Sessions' } ).click();

        const summary = page.getByText( /^\d+ sessions logged$/ );

        await expect( summary ).toBeVisible();
        const total = Number( ( await summary.textContent() )!.split( ' ' )[0] );
        const sessions = page.locator( 'main section ol > li' );
        const days = page.getByRole( 'main' ).getByRole( 'region' );

        await expect( sessions ).toHaveCount( Math.min( total, 20 ) );
        await expect( days.first() ).toContainText( /\d+(h|m)( \d+m)? studied/ );

        // Alice studied on most of the last 30 days: more than one page.
        expect( total ).toBeGreaterThan( 20 );
        while ( await page.getByRole( 'button', { name: /^Show more/ } ).isVisible() ) {
            const before = await sessions.count();

            await expect( page.getByRole( 'button', { name: /^Show more/ } ) ).toHaveText( `Show more (${total - before} left)` );
            await page.getByRole( 'button', { name: /^Show more/ } ).click();
            await expect( sessions ).not.toHaveCount( before );
        }
        await expect( sessions ).toHaveCount( total );

        // Each day appears once.
        const headings = await days.getByRole( 'heading', { level: 2 } ).allTextContents();

        expect( new Set( headings ).size ).toBe( headings.length );
    } );

    test( 'a new user is told how to start', async ( { page, api } ) => {
        await logIn( page, await api.signUp() );
        await page.goto( '/app/sessions' );

        await expect( page.getByText( 'Log the time you spend studying.' ) ).toBeVisible();
        await expect( page.getByText( 'No study sessions yet. Log your first one to start your streak.' ) ).toBeVisible();
    } );

    test( 'when loading fails, says so and can try again', async ( { page, api } ) => {
        await logIn( page, await api.signUp() );
        const restore = await failRequests( page, '/me/study-sessions?*', 'GET' );

        await page.goto( '/app/sessions' );
        await expect( page.getByRole( 'alert' ) ).toContainText( OFFLINE );

        await restore();
        await page.getByRole( 'button', { name: 'Try again' } ).click();
        await expect( page.getByText( 'No study sessions yet. Log your first one to start your streak.' ) ).toBeVisible();
    } );
} );

test.describe( 'Logging a session', () => {
    test( 'logs a session on an item and shows it under today', async ( { page, api } ) => {
        await asLearner( page, api );
        await page.goto( '/app/sessions' );
        await page.getByRole( 'button', { name: 'Log session' } ).click();

        const form = logForm( page );

        // A 30-minute session that just ended, by default.
        await expect( form.getByLabel( 'Minutes' ) ).toHaveValue( '30' );
        await expect( form.getByLabel( 'Date' ) ).not.toHaveValue( '' );
        await expect( form.getByLabel( 'Topic' ) ).toBeDisabled();
        await expect( form.getByLabel( 'Item (optional)' ) ).toBeDisabled();

        await form.getByLabel( 'Learning path' ).selectOption( { label: DSA } );
        await form.getByLabel( 'Topic' ).selectOption( { label: 'Two Pointers' } );
        await form.getByLabel( 'Item (optional)' ).selectOption( { label: 'Valid Palindrome' } );
        await form.getByLabel( 'Minutes' ).fill( '45' );
        await form.getByLabel( 'Notes (optional)' ).fill( 'Skip non-alphanumerics' );
        await form.getByRole( 'button', { name: 'Log session' } ).click();

        await expect( page.getByRole( 'status' ) ).toHaveText( 'Session logged.' );
        await expect( form ).toHaveCount( 0 );
        await expect( page.getByText( '1 session logged' ) ).toBeVisible();

        const today = page.getByRole( 'region', { name: 'Today' } );

        await expect( today ).toContainText( '45m studied' );
        await expect( today ).toContainText( 'Valid Palindrome' );
        await expect( today ).toContainText( /Two Pointers · \d{1,2}:\d{2} [AP]M/ );
        await expect( today ).toContainText( 'Skip non-alphanumerics' );
    } );

    test( 'logs a session on a whole topic', async ( { page, api } ) => {
        await asLearner( page, api );
        await page.goto( '/app/sessions?log' );

        const form = logForm( page );

        await form.getByLabel( 'Learning path' ).selectOption( { label: DSA } );
        await form.getByLabel( 'Topic' ).selectOption( { label: 'Sliding Window' } );
        await expect( selected( page, 'Item (optional)' ) ).toHaveText( 'Whole topic' );
        await form.getByRole( 'button', { name: 'Log session' } ).click();

        await expect( page.getByRole( 'status' ) ).toHaveText( 'Session logged.' );
        await expect( page.getByRole( 'region', { name: 'Today' } ) ).toContainText( 'Sliding Window' );
        await expect( page.getByRole( 'region', { name: 'Today' } ) ).toContainText( '30m' );
    } );

    test( 'offers topics grouped by module, only from the enrolled parts, and optional items as such', async ( { page, api } ) => {
        const user = await api.signUp();

        await api.enroll( user, DSA, [ { scope: 'module', title: 'Dynamic Programming', mode: 'exclude' } ] );
        await logIn( page, user );
        await page.goto( '/app/sessions?log' );

        const form = logForm( page );

        await form.getByLabel( 'Learning path' ).selectOption( { label: DSA } );
        await expect( form.getByLabel( 'Topic' ).locator( 'optgroup' ) ).toHaveCount( 3 );
        await expect( form.getByLabel( 'Topic' ).locator( 'optgroup[label="Linked Lists"] option' ) )
            .toHaveText( [ 'Linked List Basics', 'Fast & Slow Pointers' ] );
        await expect( form.getByLabel( 'Topic' ).locator( 'option', { hasText: '1-D DP' } ) ).toHaveCount( 0 );

        await form.getByLabel( 'Topic' ).selectOption( { label: 'Hashing Basics' } );
        await expect( form.getByLabel( 'Item (optional)' ).locator( 'option' ) )
            .toHaveText( [ 'Whole topic', 'Two Sum', 'Contains Duplicate', 'Group Anagrams', 'Hash Tables Explained (optional)' ] );
    } );

    test( 'choosing another path or topic clears what was chosen under it', async ( { page, api } ) => {
        const { user } = await asLearner( page, api );

        await api.enroll( user, 'System Design Fundamentals' );
        await page.goto( '/app/sessions?log' );

        const form = logForm( page );

        await form.getByLabel( 'Learning path' ).selectOption( { label: DSA } );
        await form.getByLabel( 'Topic' ).selectOption( { label: 'Hashing Basics' } );
        await form.getByLabel( 'Item (optional)' ).selectOption( { label: 'Two Sum' } );

        await form.getByLabel( 'Topic' ).selectOption( { label: 'Two Pointers' } );
        await expect( selected( page, 'Item (optional)' ) ).toHaveText( 'Whole topic' );

        await form.getByLabel( 'Learning path' ).selectOption( { label: 'System Design Fundamentals' } );
        await expect( selected( page, 'Topic' ) ).toHaveText( 'Choose a topic' );
        await expect( form.getByLabel( 'Item (optional)' ) ).toBeDisabled();
    } );

    test( 'checks the form before saving', async ( { page, api } ) => {
        await asLearner( page, api );
        await page.goto( '/app/sessions?log' );

        const form = logForm( page );
        const save = form.getByRole( 'button', { name: 'Log session' } );

        await save.click();
        await expect( form.getByText( 'Choose a learning path.' ) ).toBeVisible();
        await expect( form.getByLabel( 'Learning path' ) ).toBeFocused();

        await form.getByLabel( 'Learning path' ).selectOption( { label: DSA } );
        await save.click();
        await expect( form.getByText( 'Choose a topic.' ) ).toBeVisible();

        await form.getByLabel( 'Topic' ).selectOption( { label: 'Hashing Basics' } );
        for ( const minutes of [ '0', '1441', '', '2.5' ] ) {
            await form.getByLabel( 'Minutes' ).fill( minutes );
            await save.click();
            await expect( form.getByText( 'Enter the minutes you studied, from 1 to 1440.' ) ).toBeVisible();
        }
        await form.getByLabel( 'Minutes' ).fill( '20' );

        await form.getByLabel( 'Date' ).fill( '' );
        await save.click();
        await expect( form.getByText( 'Enter the date you studied.' ) ).toBeVisible();

        const tomorrow = new Date( Date.now() + 86_400_000 ).toISOString().slice( 0, 10 );

        await form.getByLabel( 'Date' ).fill( tomorrow );
        await save.click();
        await expect( form.getByText( 'The start can\'t be in the future.' ) ).toBeVisible();

        await form.getByLabel( 'Notes (optional)' ).fill( 'x'.repeat( 10_001 ) );
        await save.click();
        await expect( form.getByText( 'Notes can be at most 10,000 characters.' ) ).toBeVisible();

        // Nothing was saved.
        await expect( page.getByText( 'No study sessions yet. Log your first one to start your streak.' ) ).toBeVisible();
    } );

    test( 'logs a session on an earlier day', async ( { page, api } ) => {
        await asLearner( page, api );
        await page.goto( '/app/sessions?log' );

        const form = logForm( page );
        const yesterday = new Date( Date.now() - 86_400_000 ).toISOString().slice( 0, 10 );

        await form.getByLabel( 'Learning path' ).selectOption( { label: DSA } );
        await form.getByLabel( 'Topic' ).selectOption( { label: 'Tree Traversals' } );
        await form.getByLabel( 'Date' ).fill( yesterday );
        await form.getByLabel( 'Start time' ).fill( '18:30' );
        await form.getByLabel( 'Minutes' ).fill( '60' );
        await form.getByRole( 'button', { name: 'Log session' } ).click();

        const day = page.getByRole( 'region', { name: 'Yesterday' } );

        await expect( day ).toContainText( '1h studied' );
        await expect( day ).toContainText( '6:30 PM' );
    } );

    test( 'Cancel closes the form without saving', async ( { page, api } ) => {
        await asLearner( page, api );
        await page.goto( '/app/sessions' );
        await page.getByRole( 'button', { name: 'Log session' } ).click();
        await logForm( page ).getByLabel( 'Learning path' ).selectOption( { label: DSA } );
        await logForm( page ).getByRole( 'button', { name: 'Cancel' } ).click();

        await expect( logForm( page ) ).toHaveCount( 0 );
        await expect( page.getByRole( 'button', { name: 'Log session' } ) ).toBeVisible();
        await expect( page.getByText( 'No study sessions yet. Log your first one to start your streak.' ) ).toBeVisible();
    } );

    test( 'someone without learning paths is told to enroll first', async ( { page, api } ) => {
        await logIn( page, await api.signUp() );
        await page.goto( '/app/sessions?log' );

        await expect( logForm( page ) ).toContainText( 'You aren\'t following any learning paths yet.' );
        await expect( logForm( page ).getByRole( 'button', { name: 'Log session' } ) ).toHaveCount( 0 );
        await expect( logForm( page ).getByRole( 'button', { name: 'Cancel' } ) ).toBeVisible();
    } );

    test( 'when saving fails, says so and keeps what was typed', async ( { page, api } ) => {
        await asLearner( page, api );
        await page.goto( '/app/sessions?log' );

        const form = logForm( page );

        await form.getByLabel( 'Learning path' ).selectOption( { label: DSA } );
        await form.getByLabel( 'Topic' ).selectOption( { label: 'Hashing Basics' } );
        await form.getByLabel( 'Notes (optional)' ).fill( 'Keep me' );

        const restore = await failRequests( page, '/me/study-sessions', 'POST' );

        await form.getByRole( 'button', { name: 'Log session' } ).click();
        await expect( form.getByRole( 'alert' ) ).toHaveText( OFFLINE );
        await expect( form.getByLabel( 'Notes (optional)' ) ).toHaveValue( 'Keep me' );

        await restore();
        await form.getByRole( 'button', { name: 'Log session' } ).click();
        await expect( page.getByRole( 'status' ) ).toHaveText( 'Session logged.' );
    } );
} );

test.describe( 'Changing a session', () => {
    test( 'edits the time, minutes and notes', async ( { page, api } ) => {
        const user = await api.signUp();
        const enrollment = await api.enroll( user, DSA );

        await api.logSession( user, enrollment, { topic: 'Two Pointers', item: '3Sum', durationMinutes: 25, notes: 'First try' } );
        await logIn( page, user );
        await page.goto( '/app/sessions' );

        const today = page.getByRole( 'region', { name: 'Today' } );

        await today.getByRole( 'button', { name: 'Edit' } ).click();

        const form = page.getByRole( 'form', { name: 'Edit session' } );

        await expect( form ).toContainText( '3Sum · Two Pointers' );
        await expect( form.getByLabel( 'Minutes' ) ).toHaveValue( '25' );
        await expect( form.getByLabel( 'Notes (optional)' ) ).toHaveValue( 'First try' );
        // What it was about can't be changed here.
        await expect( form.getByLabel( 'Learning path' ) ).toHaveCount( 0 );

        await form.getByLabel( 'Minutes' ).fill( '50' );
        await form.getByLabel( 'Notes (optional)' ).fill( 'Second try, cleaner' );
        await form.getByRole( 'button', { name: 'Save changes' } ).click();

        await expect( page.getByRole( 'status' ) ).toHaveText( 'Changes saved.' );
        await expect( today ).toContainText( '50m studied' );
        await expect( today ).toContainText( 'Second try, cleaner' );
        await expect( today ).not.toContainText( 'First try' );
    } );

    test( 'clearing the notes removes them, and the form checks the minutes', async ( { page, api } ) => {
        const user = await api.signUp();
        const enrollment = await api.enroll( user, DSA );

        await api.logSession( user, enrollment, { topic: 'Hashing Basics', notes: 'Remove me' } );
        await logIn( page, user );
        await page.goto( '/app/sessions' );
        await page.getByRole( 'button', { name: 'Edit' } ).click();

        const form = page.getByRole( 'form', { name: 'Edit session' } );

        await form.getByLabel( 'Minutes' ).fill( '0' );
        await form.getByRole( 'button', { name: 'Save changes' } ).click();
        await expect( form.getByText( 'Enter the minutes you studied, from 1 to 1440.' ) ).toBeVisible();

        await form.getByLabel( 'Minutes' ).fill( '30' );
        await form.getByLabel( 'Notes (optional)' ).fill( '   ' );
        await form.getByRole( 'button', { name: 'Save changes' } ).click();

        await expect( page.getByRole( 'status' ) ).toHaveText( 'Changes saved.' );
        await expect( page.getByText( 'Remove me' ) ).toHaveCount( 0 );
    } );

    test( 'Cancel leaves the session as it was', async ( { page, api } ) => {
        const user = await api.signUp();
        const enrollment = await api.enroll( user, DSA );

        await api.logSession( user, enrollment, { topic: 'Hashing Basics', durationMinutes: 40 } );
        await logIn( page, user );
        await page.goto( '/app/sessions' );
        await page.getByRole( 'button', { name: 'Edit' } ).click();
        await page.getByRole( 'form', { name: 'Edit session' } ).getByLabel( 'Minutes' ).fill( '99' );
        await page.getByRole( 'form', { name: 'Edit session' } ).getByRole( 'button', { name: 'Cancel' } ).click();

        await expect( page.getByRole( 'form', { name: 'Edit session' } ) ).toHaveCount( 0 );
        await expect( page.getByRole( 'region', { name: 'Today' } ) ).toContainText( '40m studied' );
    } );

    test( 'deletes a session after confirming, and Keep backs out', async ( { page, api } ) => {
        const user = await api.signUp();
        const enrollment = await api.enroll( user, DSA );

        await api.logSession( user, enrollment, { topic: 'Hashing Basics', notes: 'To delete' } );
        await api.logSession( user, enrollment, { topic: 'Two Pointers', notes: 'To keep', minutesAgo: 1 } );
        await logIn( page, user );
        await page.goto( '/app/sessions' );

        const row = page.getByRole( 'listitem' ).filter( { hasText: 'To delete' } );

        await row.getByRole( 'button', { name: 'Delete' } ).click();
        const confirm = row.getByRole( 'group', { name: 'Delete this session?' } );

        await expect( confirm ).toBeVisible();
        await confirm.getByRole( 'button', { name: 'Keep' } ).click();
        await expect( confirm ).toHaveCount( 0 );

        await row.getByRole( 'button', { name: 'Delete' } ).click();
        await row.getByRole( 'group', { name: 'Delete this session?' } ).getByRole( 'button', { name: 'Delete' } ).click();

        await expect( page.getByRole( 'status' ) ).toHaveText( 'Session deleted.' );
        await expect( page.getByText( 'To delete' ) ).toHaveCount( 0 );
        await expect( page.getByText( 'To keep' ) ).toBeVisible();
        await expect( page.getByText( '1 session logged' ) ).toBeVisible();
    } );

    test( 'when deleting fails, says so and lets the user try again', async ( { page, api } ) => {
        const user = await api.signUp();
        const enrollment = await api.enroll( user, DSA );

        await api.logSession( user, enrollment, { topic: 'Hashing Basics' } );
        await logIn( page, user );
        await page.goto( '/app/sessions' );

        const restore = await failRequests( page, '/me/study-sessions/*', 'DELETE' );

        await page.getByRole( 'button', { name: 'Delete' } ).click();
        await page.getByRole( 'group', { name: 'Delete this session?' } ).getByRole( 'button', { name: 'Delete' } ).click();
        await expect( page.getByRole( 'alert' ) ).toHaveText( 'Couldn\'t delete this session. Please try again.' );

        await restore();
        await page.getByRole( 'group', { name: 'Delete this session?' } ).getByRole( 'button', { name: 'Delete' } ).click();
        await expect( page.getByRole( 'status' ) ).toHaveText( 'Session deleted.' );
        await expect( page.getByText( 'No study sessions yet. Log your first one to start your streak.' ) ).toBeVisible();
    } );
} );
