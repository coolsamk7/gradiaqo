import { expect, failRequests, logIn, OFFLINE, test } from './support/fixtures.ts';

const DSA = 'Data Structures & Algorithms';

test.describe( 'Analytics', () => {
    test( 'shows study time, progress and topics that need focus for a new learner', async ( { page, api } ) => {
        const user = await api.signUp();
        const enrollment = await api.enroll( user, DSA );

        await api.logSession( user, enrollment, { topic: 'Hashing Basics', item: 'Two Sum', durationMinutes: 45 } );
        await logIn( page, user );
        await page.getByRole( 'navigation', { name: 'Main' } ).getByRole( 'link', { name: 'Analytics' } ).click();

        await expect( page ).toHaveURL( '/app/analytics' );
        await expect( page.getByRole( 'heading', { level: 1, name: 'Analytics' } ) ).toBeVisible();
        const tile = ( label: string ) =>
            page.locator( 'dt', { hasText: new RegExp( `^${label}$` ) } ).locator( 'xpath=following-sibling::dd[1]' );

        await expect( tile( 'Time studied' ) ).toHaveText( '45m' );
        await expect( tile( 'Topics completed' ) ).toHaveText( /^0 of \d+$/ );

        const weekly = page.getByRole( 'region', { name: 'Study time per week' } );

        await expect( weekly.getByRole( 'list', { name: 'Minutes studied per week' } ).getByRole( 'listitem' ) ).toHaveCount( 12 );
        await expect( page.getByRole( 'region', { name: 'Where your time went' } ) ).toContainText( `${DSA}45m` );
        await expect( page.getByRole( 'region', { name: 'Item status' } ) ).toContainText( /\d+ items you follow/ );
        await expect( page.getByRole( 'region', { name: 'By difficulty' } ) ).toContainText( 'Sessions1' );

        // A topic that needs focus opens on the path page.
        const focus = page.getByRole( 'region', { name: 'Needs focus' } );
        const first = focus.getByRole( 'listitem' ).first();
        const topicTitle = await first.getByRole( 'heading', { level: 3 } ).textContent();

        await first.getByRole( 'link', { name: /^Open / } ).click();
        await expect( page ).toHaveURL( new RegExp( `/app/paths/${enrollment.id}\\?topic=` ) );
        await expect( page.locator( 'details[open]', { has: page.getByRole( 'heading', { level: 3, name: topicTitle!, exact: true } ) } ) )
            .toBeVisible();
    } );

    test( 'filters by period and path, kept in the URL', async ( { page, api } ) => {
        const user = await api.signUp();
        const dsa = await api.enroll( user, DSA );

        await api.enroll( user, 'System Design Fundamentals' );
        await api.logSession( user, dsa, { topic: 'Hashing Basics', durationMinutes: 30 } );
        await logIn( page, user );
        await page.goto( '/app/analytics' );

        await page.getByRole( 'button', { name: '90 days' } ).click();
        await expect( page ).toHaveURL( '/app/analytics?period=90d' );
        await expect( page.getByRole( 'region', { name: 'Where your time went' } ) ).toContainText( 'Last 90 days' );

        await page.getByRole( 'combobox', { name: 'Path' } ).selectOption( { label: 'System Design Fundamentals' } );
        await expect( page ).toHaveURL( /period=90d&path=[\da-f-]{36}$/ );
        await expect( page.getByText( 'In this path' ) ).toBeVisible();
        await expect( page.getByText( 'No study time in this period yet.' ) ).toBeVisible();

        await page.reload();
        await expect( page.getByRole( 'combobox', { name: 'Path' } ) ).toHaveValue( /[\da-f-]{36}/ );
        await expect( page.getByRole( 'button', { name: '90 days' } ) ).toHaveAttribute( 'aria-pressed', 'true' );
    } );

    test( 'says when StudyLog can\'t be reached, and tries again', async ( { page, api } ) => {
        await logIn( page, await api.signUp() );
        const restore = await failRequests( page, '/me/analytics*' );

        await page.goto( '/app/analytics' );
        await expect( page.getByRole( 'alert' ) ).toContainText( OFFLINE );

        await restore();
        await page.getByRole( 'button', { name: 'Try again' } ).click();
        await expect( page.getByText( 'Time studied' ) ).toBeVisible();
    } );
} );
