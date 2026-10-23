import { expect, logIn, test } from './support/fixtures.ts';

const DSA = 'Data Structures & Algorithms';

/** A date `days` from today as `<input type="date">` wants it (tests run in UTC). */
const inDays = ( days: number ) => new Date( Date.now() + days * 86_400_000 ).toISOString().slice( 0, 10 );

test.describe( 'Interview ready', () => {
    test( 'sets a goal, then shows the score, categories and next steps', async ( { page, api } ) => {
        const user = await api.signUp();
        const enrollment = await api.enroll( user, DSA );

        await api.enroll( user, 'System Design Fundamentals' );
        await logIn( page, user );
        await page.getByRole( 'navigation', { name: 'Main' } ).getByRole( 'link', { name: 'Interview ready' } ).click();

        await expect( page ).toHaveURL( '/app/interview-ready' );
        await expect( page.getByRole( 'heading', { level: 2, name: 'Set an interview goal' } ) ).toBeVisible();
        await page.getByRole( 'button', { name: 'Set a goal' } ).click();

        const dialog = page.getByRole( 'dialog', { name: 'Your interview goal' } );

        await dialog.getByRole( 'button', { name: 'Save goal' } ).click();
        await expect( dialog ).toContainText( 'Enter what you\'re preparing for.' );

        await dialog.getByLabel( 'What are you preparing for?' ).fill( 'SDE interview' );
        await dialog.getByLabel( 'Date' ).fill( inDays( 30 ) );
        await dialog.getByRole( 'checkbox', { name: new RegExp( DSA ) } ).check();
        await expect( dialog ).toContainText( '25 items' );
        await dialog.getByRole( 'button', { name: 'Save goal' } ).click();
        await expect( dialog ).toBeHidden();

        await expect( page.getByRole( 'img', { name: /^Readiness score: \d+ of 100$/ } ) ).toBeVisible();
        await expect( page.getByRole( 'heading', { level: 2, name: /^SDE interview · / } ) ).toBeVisible();
        await expect( page.getByText( `Based on ${DSA}.`, { exact: false } ) ).toBeVisible();
        await expect( page.getByText( 'Time left' ).locator( 'xpath=following-sibling::dd[1]' ) ).toHaveText( '30 days' );
        for ( const name of [ 'Coverage', 'Depth', 'Revision', 'Consistency' ] ) {
            await expect( page.getByRole( 'region', { name } ) ).toBeVisible();
        }

        // The weakest module comes first; its button opens the topic on the path page.
        const steps = page.getByRole( 'region', { name: 'Your next steps' } );
        const first = steps.getByRole( 'listitem' ).first();

        await expect( first ).toContainText( /^Finish .+: \d+ required items? left/ );
        await expect( first ).toContainText( 'High' );
        await first.getByRole( 'link', { name: /^Open: / } ).click();
        await expect( page ).toHaveURL( new RegExp( `/app/paths/${enrollment.id}\\?topic=` ) );
    } );

    test( 'edits the goal', async ( { page, api } ) => {
        const user = await api.signUp();

        await api.enroll( user, DSA );
        await api.enroll( user, 'System Design Fundamentals' );
        await logIn( page, user );
        await page.goto( '/app/interview-ready' );
        await page.getByRole( 'button', { name: 'Set a goal' } ).click();

        let dialog = page.getByRole( 'dialog', { name: 'Your interview goal' } );

        await dialog.getByLabel( 'What are you preparing for?' ).fill( 'Backend interview' );
        await dialog.getByLabel( 'Date' ).fill( inDays( 10 ) );
        await dialog.getByRole( 'checkbox', { name: new RegExp( DSA ) } ).check();
        await dialog.getByRole( 'button', { name: 'Save goal' } ).click();
        await expect( page.getByRole( 'heading', { level: 2, name: /^Backend interview · / } ) ).toBeVisible();

        await page.getByRole( 'button', { name: 'Edit goal' } ).click();
        dialog = page.getByRole( 'dialog', { name: 'Your interview goal' } );
        await expect( dialog.getByLabel( 'What are you preparing for?' ) ).toHaveValue( 'Backend interview' );
        await expect( dialog.getByLabel( 'Date' ) ).toHaveValue( inDays( 10 ) );
        await dialog.getByRole( 'checkbox', { name: /System Design Fundamentals/ } ).check();
        await dialog.getByRole( 'button', { name: 'Save goal' } ).click();

        await expect( page.getByText( `Based on ${DSA} and System Design Fundamentals.`, { exact: false } ) ).toBeVisible();
    } );
} );
