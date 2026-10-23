import { randomUUID } from 'node:crypto';

import { expect, logIn, test } from './support/fixtures.ts';

const ADMIN = 'admin@example.com';

test.describe( 'Admin', () => {
    // Paths of their own, so the seeded ones stay public for the other tests.
    test( 'a superadmin hides a reported path, un-hides it, and dismisses another report', async ( { page, api } ) => {
        const owner = await api.signUp( 'Owen' );
        const reporter = await api.signUp( 'Rita' );
        const tag = randomUUID().slice( 0, 8 );
        const copied = await api.sharePath( owner, `Copied Path ${tag}` );
        const fine = await api.sharePath( owner, `Fine Path ${tag}` );

        await api.report( reporter, copied.id, 'copyright', 'Copied from a paid course.' );
        await api.report( reporter, fine.id, 'spam' );

        await logIn( page, ADMIN );
        await page.getByRole( 'navigation', { name: 'Admin and settings' } ).getByRole( 'link', { name: 'Admin' } ).click();
        await expect( page ).toHaveURL( '/app/admin/reports' );

        const report = page.getByRole( 'region', { name: `Report on ${copied.title}` } );

        await expect( report ).toContainText( 'Public path by Owen Tester' );
        await expect( report ).toContainText( 'Reason: Copyright' );
        await expect( report ).toContainText( '“Copied from a paid course.”Reported by Rita Tester · today' );
        await report.getByLabel( 'Note (optional)' ).fill( 'Matches the course word for word.' );
        await report.getByRole( 'button', { name: 'Hide path' } ).click();
        await expect( report ).toBeHidden();

        const recent = page.getByRole( 'region', { name: 'Recently resolved' } );
        const row = recent.getByRole( 'listitem' ).filter( { hasText: copied.title } );

        await expect( row ).toContainText( 'Path hidden by' );
        await expect( row ).toContainText( '“Matches the course word for word.”' );
        await expect( row ).toContainText( /Hidden$/ );

        // Hidden by mistake: un-hide it, so its owner can make it public again.
        await row.getByRole( 'button', { name: `Un-hide ${copied.title}` } ).click();
        await expect( row ).toContainText( 'Un-hidden' );
        await expect( row.getByRole( 'button' ) ).toHaveCount( 0 );

        await page.getByRole( 'region', { name: `Report on ${fine.title}` } ).getByRole( 'button', { name: 'Dismiss' } ).click();
        await page.getByRole( 'tab', { name: 'Resolved' } ).click();
        await expect( page.getByRole( 'region', { name: 'Resolved reports' } ).getByRole( 'listitem' ).filter( { hasText: fine.title } ) )
            .toContainText( 'Dismissed' );
    } );

    test( 'the admin pages don\'t exist for other users', async ( { page, api } ) => {
        await logIn( page, await api.signUp() );
        await expect( page.getByRole( 'link', { name: 'Admin' } ) ).toHaveCount( 0 );

        await page.goto( '/app/admin/reports' );
        await expect( page.getByRole( 'heading', { level: 1, name: 'Page not found' } ) ).toBeVisible();
    } );
} );
