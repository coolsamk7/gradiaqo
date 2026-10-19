import type { Page } from '@playwright/test';

import { expect, failRequests, logIn, OFFLINE, SEEDED, test } from './support/fixtures.ts';

const DSA = 'Data Structures & Algorithms';
const NOT_ON_LIST = 'This learning path isn\'t on your list.';

const moduleCard = ( page: Page, title: string ) => page.getByRole( 'region', { name: title } );
const topic = ( page: Page, title: string ) =>
    page.locator( 'details', { has: page.getByRole( 'heading', { level: 3, name: title, exact: true } ) } );
const item = ( page: Page, title: string ) =>
    page.getByRole( 'listitem' ).filter( { has: page.getByText( title, { exact: true } ) } );

/** A new user enrolled in the DSA path, on its page. */
async function openNewEnrollment( page: Page, api: import( './support/api.ts' ).Api, rules?: Parameters<typeof api.enroll>[2] ) {
    const user = await api.signUp();
    const enrollment = await api.enroll( user, DSA, rules );

    await logIn( page, user );
    await page.goto( `/app/paths/${enrollment.id}` );
    await expect( page.getByRole( 'heading', { level: 1, name: DSA } ) ).toBeVisible();

    return { user, enrollment };
}

test.describe( 'Learning path page', () => {
    test( 'shows the path, its modules and progress at every level', async ( { page, api } ) => {
        await openNewEnrollment( page, api );

        await expect( page.getByText( 'The classic interview patterns, one module at a time.' ) ).toBeVisible();
        await expect( page.getByText( '0 of 25 items done · 0%' ) ).toBeVisible();
        await expect( page.getByRole( 'progressbar', { name: `${DSA} progress` } ) ).toHaveAttribute( 'aria-valuenow', '0' );
        await expect( page.getByRole( 'heading', { level: 2 } ) )
            .toHaveText( [ 'Arrays & Hashing', 'Linked Lists', 'Trees', 'Dynamic Programming' ] );

        const arrays = moduleCard( page, 'Arrays & Hashing' );

        await expect( arrays ).toContainText( '0 of 9 done' );
        await expect( arrays ).toContainText( 'Most problems start here.' );
        await expect( arrays.getByRole( 'heading', { level: 3 } ) ).toHaveText( [ 'Hashing Basics', 'Two Pointers', 'Sliding Window' ] );
        // Optional items don't count: 3 required of 4.
        await expect( topic( page, 'Hashing Basics' ).locator( 'summary' ) ).toContainText( '0/3' );
    } );

    test( 'opens the first unfinished topic, and the others on click', async ( { page, api } ) => {
        await openNewEnrollment( page, api );

        await expect( topic( page, 'Hashing Basics' ) ).toHaveAttribute( 'open', '' );
        await expect( topic( page, 'Two Pointers' ) ).not.toHaveAttribute( 'open' );
        await expect( item( page, 'Two Sum' ) ).toBeVisible();
        await expect( item( page, 'Valid Palindrome' ) ).toBeHidden();

        await topic( page, 'Two Pointers' ).getByRole( 'heading', { name: 'Two Pointers' } ).click();
        await expect( item( page, 'Valid Palindrome' ) ).toBeVisible();
        await expect( topic( page, 'Sliding Window' ) ).not.toHaveAttribute( 'open' );
    } );

    test( 'starts where the user left off', async ( { page, api } ) => {
        const user = await api.signUp();
        const enrollment = await api.enroll( user, DSA );

        await logIn( page, user );
        await page.goto( `/app/paths/${enrollment.id}` );
        for ( const title of [ 'Two Sum', 'Contains Duplicate', 'Group Anagrams' ] ) {
            await page.getByLabel( `Status of ${title}` ).selectOption( { label: 'Done' } );
            await expect( page.getByLabel( `Status of ${title}` ) ).toBeEnabled();
        }
        await page.reload();

        await expect( topic( page, 'Hashing Basics' ) ).not.toHaveAttribute( 'open' );
        await expect( topic( page, 'Two Pointers' ) ).toHaveAttribute( 'open', '' );
    } );

    test( 'describes each item', async ( { page, api } ) => {
        await openNewEnrollment( page, api );
        await topic( page, 'Binary Search Trees' ).getByRole( 'heading' ).click();

        await expect( item( page, 'Two Sum' ) ).toContainText( 'Problem · Easy · 15 min' );
        await expect( item( page, 'Hash Tables Explained' ) ).toContainText( 'Article · 20 min · Optional' );
        await expect( item( page, 'Introduction to Algorithms: Binary Search Trees' ) )
            .toContainText( 'Book · 90 min · Optional · Cormen et al. · Ch. 12' );
    } );

    test( 'links to items that live elsewhere, in a new tab', async ( { page, api } ) => {
        await openNewEnrollment( page, api );

        const leetcode = item( page, 'Two Sum' ).getByRole( 'link', { name: 'Open on LeetCode (opens in a new tab)' } );

        await expect( leetcode ).toHaveAttribute( 'href', 'https://leetcode.com/problems/two-sum/' );
        await expect( leetcode ).toHaveAttribute( 'target', '_blank' );
        await expect( leetcode ).toHaveAttribute( 'rel', 'noreferrer' );
        await expect( item( page, 'Hash Tables Explained' ).getByRole( 'link', { name: 'Open (opens in a new tab)' } ) )
            .toHaveAttribute( 'href', 'https://en.wikipedia.org/wiki/Hash_table' );
    } );

    test( 'shows notes, and exercise answers only on request', async ( { page, api } ) => {
        await openNewEnrollment( page, api );

        await topic( page, 'Linked List Basics' ).getByRole( 'heading' ).click();
        const note = item( page, 'The Dummy Head Trick' );

        await expect( note.getByText( 'No special case for changing the first node.' ) ).toBeHidden();
        await note.getByText( 'Show note' ).click();
        await expect( note.getByText( /No special case for changing the first node\./ ) ).toBeVisible();

        await topic( page, 'Tree Traversals' ).getByRole( 'heading' ).click();
        const exercise = item( page, 'Iterative Inorder Traversal' );

        await exercise.getByText( 'Show instructions' ).click();
        await expect( exercise.getByText( /without recursion/ ) ).toBeVisible();
        await expect( exercise.getByText( /Push left children onto a stack/ ) ).toBeHidden();
        await exercise.getByText( 'Show answer' ).click();
        await expect( exercise.getByText( /Push left children onto a stack/ ) ).toBeVisible();
    } );

    test( 'items without written content have nothing to expand', async ( { page, api } ) => {
        await openNewEnrollment( page, api );

        await expect( item( page, 'Two Sum' ).getByText( /^Show / ) ).toHaveCount( 0 );
    } );
} );

test.describe( 'Progress', () => {
    test( 'saving a status updates the counts of the topic, module and path', async ( { page, api } ) => {
        await openNewEnrollment( page, api );

        const status = page.getByLabel( 'Status of Two Sum' );

        await expect( status ).toHaveValue( 'not_started' );
        await expect( status.locator( 'option' ) ).toHaveText( [ 'Not started', 'In progress', 'Done', 'Revise' ] );

        await status.selectOption( { label: 'Done' } );
        await expect( topic( page, 'Hashing Basics' ).locator( 'summary' ) ).toContainText( '1/3' );
        await expect( moduleCard( page, 'Arrays & Hashing' ) ).toContainText( '1 of 9 done' );
        await expect( page.getByText( '1 of 25 items done · 4%' ) ).toBeVisible();
        await expect( page.getByRole( 'progressbar', { name: `${DSA} progress` } ) ).toHaveAttribute( 'aria-valuenow', '4' );

        // Saved: still there after a reload.
        await page.reload();
        await expect( page.getByLabel( 'Status of Two Sum' ) ).toHaveValue( 'done' );
    } );

    test( '"Revise" counts as done, "In progress" doesn\'t, and optional items never count', async ( { page, api } ) => {
        await openNewEnrollment( page, api );
        const count = topic( page, 'Hashing Basics' ).locator( 'summary' );

        await page.getByLabel( 'Status of Contains Duplicate' ).selectOption( { label: 'Revise' } );
        await expect( count ).toContainText( '1/3' );

        await page.getByLabel( 'Status of Group Anagrams' ).selectOption( { label: 'In progress' } );
        await expect( page.getByLabel( 'Status of Group Anagrams' ) ).toHaveValue( 'in_progress' );
        await expect( count ).toContainText( '1/3' );

        await page.getByLabel( 'Status of Hash Tables Explained' ).selectOption( { label: 'Done' } );
        await expect( page.getByLabel( 'Status of Hash Tables Explained' ) ).toHaveValue( 'done' );
        await expect( count ).toContainText( '1/3' );

        await page.getByLabel( 'Status of Contains Duplicate' ).selectOption( { label: 'Not started' } );
        await expect( count ).toContainText( '0/3' );
    } );

    test( 'progress shows on the dashboard too', async ( { page, api } ) => {
        await openNewEnrollment( page, api );
        await page.getByLabel( 'Status of Two Sum' ).selectOption( { label: 'Done' } );
        await expect( page.getByText( '1 of 25 items done · 4%' ) ).toBeVisible();

        await page.getByRole( 'link', { name: 'Back to dashboard' } ).click();
        await expect( page ).toHaveURL( '/app' );

        const paths = page.getByRole( 'region', { name: 'Your learning paths' } );

        await expect( paths ).toContainText( '1 of 25 items done' );
        await expect( paths ).toContainText( '4%' );
    } );

    test( 'finishing every required item completes the path', async ( { page, api } ) => {
        await openNewEnrollment( page, api, [ { scope: 'topic', title: 'Fast & Slow Pointers', mode: 'include' } ] );

        await expect( page.getByText( '0 of 2 items done · 0%' ) ).toBeVisible();
        await page.getByLabel( 'Status of Linked List Cycle' ).selectOption( { label: 'Done' } );
        await expect( page.getByText( '1 of 2 items done · 50%' ) ).toBeVisible();
        await page.getByLabel( 'Status of Reorder List' ).selectOption( { label: 'Done' } );

        await expect( page.getByText( '2 of 2 items done · 100%' ) ).toBeVisible();
        await expect( page.locator( 'main' ).getByText( 'Completed', { exact: true } ) ).toBeVisible();
    } );

    test( 'when saving fails, says so and keeps the old status', async ( { page, api } ) => {
        await openNewEnrollment( page, api );
        const restore = await failRequests( page, '/me/progress/*', 'PUT' );

        await page.getByLabel( 'Status of Two Sum' ).selectOption( { label: 'Done' } );
        await expect( item( page, 'Two Sum' ).getByRole( 'alert' ) ).toHaveText( 'Couldn\'t save your progress. Please try again.' );
        await expect( page.getByLabel( 'Status of Two Sum' ) ).toHaveValue( 'not_started' );
        await expect( topic( page, 'Hashing Basics' ).locator( 'summary' ) ).toContainText( '0/3' );

        await restore();
        await page.getByLabel( 'Status of Two Sum' ).selectOption( { label: 'Done' } );
        await expect( item( page, 'Two Sum' ).getByRole( 'alert' ) ).toHaveCount( 0 );
        await expect( topic( page, 'Hashing Basics' ).locator( 'summary' ) ).toContainText( '1/3' );
    } );
} );

test.describe( 'What the user follows', () => {
    test( 'leaves out excluded parts and keeps the user\'s own order', async ( { page, api } ) => {
        const token = await api.logIn( SEEDED.alice );
        const dsa = ( await api.enrollments( token ) ).find( ( enrollment ) => enrollment.learningPath.title === DSA )!;

        await logIn( page, SEEDED.alice );
        await page.goto( `/app/paths/${dsa.id}` );

        // Alice left out Dynamic Programming and put Sliding Window first.
        await expect( page.getByRole( 'heading', { level: 2 } ) ).toHaveText( [ 'Arrays & Hashing', 'Linked Lists', 'Trees' ] );
        await expect( moduleCard( page, 'Arrays & Hashing' ).getByRole( 'heading', { level: 3 } ) )
            .toHaveText( [ 'Sliding Window', 'Hashing Basics', 'Two Pointers' ] );
        await expect( page.getByText( 'A window over a contiguous range that grows and shrinks as you go.' ) ).toBeAttached();
    } );

    test( 'labels completed and paused paths', async ( { page, api } ) => {
        const alice = await api.enrollments( await api.logIn( SEEDED.alice ) );
        const bob = await api.enrollments( await api.logIn( SEEDED.bob ) );
        const sprint = alice.find( ( enrollment ) => enrollment.learningPath.title === 'Interview Sprint' )!;
        const systemDesign = bob.find( ( enrollment ) => enrollment.learningPath.title === 'System Design Fundamentals' )!;

        await logIn( page, SEEDED.alice );
        await page.goto( `/app/paths/${sprint.id}` );
        await expect( page.locator( 'main' ).getByText( 'Completed', { exact: true } ) ).toBeVisible();
        // Everything done: no topic is opened for the user.
        await expect( page.locator( 'details[open]' ) ).toHaveCount( 0 );

        await page.getByRole( 'button', { name: 'Log out' } ).click();
        await logIn( page, SEEDED.bob );
        await page.goto( `/app/paths/${systemDesign.id}` );
        await expect( page.locator( 'main' ).getByText( 'Paused', { exact: true } ) ).toBeVisible();
    } );

    test( 'someone else\'s path isn\'t shown', async ( { page, api } ) => {
        const bob = await api.enrollments( await api.logIn( SEEDED.bob ) );

        await logIn( page, await api.signUp() );
        await page.goto( `/app/paths/${bob[0].id}` );

        await expect( page.getByRole( 'alert' ) ).toContainText( NOT_ON_LIST );
        await expect( page.getByRole( 'button', { name: 'Try again' } ) ).toHaveCount( 0 );
    } );

    for ( const id of [ '00000000-0000-4000-8000-000000000000', 'not-an-id' ] ) {
        test( `an unknown path (${id}) says it isn't on the list`, async ( { page, api } ) => {
            await logIn( page, await api.signUp() );
            await page.goto( `/app/paths/${id}` );

            await expect( page.getByRole( 'alert' ) ).toContainText( NOT_ON_LIST );
            await page.getByRole( 'link', { name: 'Back to dashboard' } ).click();
            await expect( page ).toHaveURL( '/app' );
        } );
    }

    test( 'when loading fails, says so and can try again', async ( { page, api } ) => {
        const user = await api.signUp();
        const enrollment = await api.enroll( user, DSA );

        await logIn( page, user );
        const restore = await failRequests( page, `/me/enrollments/${enrollment.id}` );

        await page.goto( `/app/paths/${enrollment.id}` );
        await expect( page.getByRole( 'alert' ) ).toContainText( OFFLINE );

        await restore();
        await page.getByRole( 'button', { name: 'Try again' } ).click();
        await expect( page.getByRole( 'heading', { level: 1, name: DSA } ) ).toBeVisible();
    } );
} );

test.describe( 'Log time on an item', () => {
    test( 'opens the session form with the path, topic and item chosen, and logs it', async ( { page, api } ) => {
        await openNewEnrollment( page, api );
        await item( page, 'Two Sum' ).getByRole( 'link', { name: 'Log time' } ).click();

        await expect( page ).toHaveURL( /\/app\/sessions\?log&path=.+&topic=.+&item=.+/ );
        const form = page.getByRole( 'form', { name: 'Log a study session' } );

        await expect( form.getByLabel( 'Learning path' ).locator( 'option:checked' ) ).toHaveText( DSA );
        await expect( form.getByLabel( 'Topic' ).locator( 'option:checked' ) ).toHaveText( 'Hashing Basics' );
        await expect( form.getByLabel( 'Item (optional)' ).locator( 'option:checked' ) ).toHaveText( 'Two Sum' );

        await form.getByLabel( 'Minutes' ).fill( '15' );
        await form.getByRole( 'button', { name: 'Log session' } ).click();

        await expect( page.getByRole( 'status' ) ).toHaveText( 'Session logged.' );
        await expect( page.getByRole( 'region', { name: 'Today' } ) ).toContainText( 'Two Sum' );
        await expect( page.getByRole( 'region', { name: 'Today' } ) ).toContainText( 'Hashing Basics' );
    } );
} );
