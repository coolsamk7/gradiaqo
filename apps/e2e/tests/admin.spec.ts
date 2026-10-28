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
        await page.getByRole( 'navigation', { name: 'Admin', exact: true } ).getByRole( 'link', { name: /^Reports/ } ).click();
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

    // Everything stays a draft and is deleted at the end, so learners' catalogs don't change for the other tests.
    test( 'a superadmin builds an official path and an item as drafts, publishes parts, and deletes them', async ( { page } ) => {
        const tag = randomUUID().slice( 0, 8 );
        const title = `Official Draft ${tag}`;

        await logIn( page, ADMIN );
        await page.getByRole( 'navigation', { name: 'Admin and settings' } ).getByRole( 'link', { name: 'Admin' } ).click();
        await expect( page ).toHaveURL( '/app/admin' );
        await page.getByRole( 'navigation', { name: 'Admin', exact: true } ).getByRole( 'link', { name: 'Catalog' } ).click();
        await expect( page ).toHaveURL( '/app/admin/catalog' );
        await expect( page.getByRole( 'region', { name: 'Paths' } ) ).toContainText( 'Data Structures & AlgorithmsPublished' );

        await page.getByRole( 'button', { name: 'New path' } ).click();
        await page.getByRole( 'dialog', { name: 'New path' } ).getByLabel( 'Title' ).fill( title );
        await page.getByRole( 'button', { name: 'Create path' } ).click();
        await expect( page.getByRole( 'heading', { level: 1, name: title } ) ).toBeVisible();
        await expect( page.getByText( 'Global catalog · a draft: learners see it once it\'s published' ) ).toBeVisible();

        const structure = page.getByRole( 'region', { name: 'Structure' } );

        await structure.getByRole( 'button', { name: 'Add a module' } ).click();
        await structure.getByLabel( 'Module title' ).fill( 'Basics' );
        await structure.getByLabel( 'Module title' ).press( 'Enter' );
        await expect( structure.getByRole( 'button', { name: /^Basics\s*Draft$/ } ) ).toBeVisible();
        await page.getByLabel( 'Status' ).selectOption( 'published' );
        await expect( structure.getByRole( 'button', { name: 'Basics', exact: true } ) ).toBeVisible();

        await page.getByRole( 'link', { name: 'Back to the global catalog' } ).click();
        const row = page.getByRole( 'region', { name: 'Paths' } ).getByRole( 'row' ).filter( { hasText: title } );

        await expect( row ).toContainText( `${title}Draft10Today` );

        // An item, published and then taken back to draft so it can be deleted.
        await page.getByRole( 'button', { name: 'Items' } ).click();
        await page.getByRole( 'button', { name: 'New item' } ).click();
        const dialog = page.getByRole( 'dialog', { name: 'New item' } );

        await dialog.getByLabel( 'Type' ).selectOption( 'note' );
        await dialog.getByLabel( 'Title', { exact: true } ).fill( `Cheat Sheet ${tag}` );
        await dialog.getByLabel( 'Note' ).fill( 'Queue, visited set, level by level.' );
        await dialog.getByRole( 'button', { name: 'Create item' } ).click();
        await expect( dialog ).toBeHidden();

        await page.getByRole( 'searchbox', { name: 'Search items' } ).fill( tag );
        // Searching waits for typing to stop; then only this item is listed (under the header row).
        await expect( page.getByRole( 'region', { name: 'Items' } ).getByRole( 'row' ) ).toHaveCount( 2 );
        const item = page.getByRole( 'region', { name: 'Items' } ).getByRole( 'row' ).filter( { hasText: `Cheat Sheet ${tag}` } );

        await expect( item ).toContainText( `Cheat Sheet ${tag}NoteDraft—Today` );
        await item.getByRole( 'button', { name: `More for Cheat Sheet ${tag}` } ).click();
        await page.getByRole( 'button', { name: 'Publish' } ).click();
        await expect( item ).toContainText( 'Published' );
        await item.getByRole( 'button', { name: `More for Cheat Sheet ${tag}` } ).click();
        await page.getByRole( 'button', { name: 'Move to draft' } ).click();
        await expect( item ).toContainText( 'Draft' );
        await item.getByRole( 'button', { name: `More for Cheat Sheet ${tag}` } ).click();
        await page.getByRole( 'button', { name: 'Delete' } ).click();
        await expect( page.getByRole( 'region', { name: 'Items' } ) ).toContainText( 'No items match.' );

        await page.getByRole( 'button', { name: 'Paths' } ).click();
        await row.getByRole( 'button', { name: `More for ${title}` } ).click();
        await page.getByRole( 'button', { name: 'Delete' } ).click();
        await expect( row ).toHaveCount( 0 );
    } );

    // A path and items of its own (shared items would be changed by the file), the path deleted at the end.
    test( 'a superadmin imports a path from a file, checking what it changes first', async ( { page } ) => {
        const tag = randomUUID().slice( 0, 8 );
        const title = `Imported Path ${tag}`;
        const file = [
            `slug: imported-${tag}`,
            `title: ${title}`,
            'modules:',
            '  - title: Basics',
            '    topics:',
            '      - title: Hashing',
            '        items:',
            '          - type: article',
            `            title: Hashing explained ${tag}`,
            `            url: https://example.com/hashing-${tag}`,
            '          - type: note',
            `            title: Hash maps ${tag}`,
            '            content: Count things in one pass.',
            '',
        ].join( '\n' );
        const choose = ( name: string, text: string ) => page.getByLabel( 'Path file' )
            .setInputFiles( { name, mimeType: 'application/yaml', buffer: Buffer.from( text ) } );

        await logIn( page, ADMIN );
        await page.goto( '/app/admin/catalog' );
        await page.getByRole( 'button', { name: 'Import file' } ).click();
        const dialog = page.getByRole( 'dialog', { name: 'Import a path' } );

        await choose( 'broken.yaml', 'slug: Not A Slug\n' );
        await expect( dialog.getByRole( 'alert' ) ).toContainText( 'The file doesn\'t match the format:' );
        await expect( dialog.getByRole( 'alert' ) ).toContainText( '/slug: must match pattern' );

        await choose( 'imported.yaml', file );
        const changes = dialog.getByRole( 'region', { name: 'What importing changes' } );

        await expect( changes ).toContainText( `${title} (imported-${tag}) · New path, a draft` );
        await expect( changes ).toContainText( '2 items: 2 new, 0 changed · 2 added to topics, 0 taken out' );
        await dialog.getByRole( 'button', { name: 'Import' } ).click();
        await expect( dialog.getByRole( 'status' ) ).toContainText( `Imported “${title}”. It's a draft` );
        await dialog.getByRole( 'button', { name: 'Done' } ).click();

        const row = page.getByRole( 'region', { name: 'Paths' } ).getByRole( 'row' ).filter( { hasText: title } );

        await expect( row ).toContainText( `${title}Draft12Today` );

        // The same file again: nothing to do.
        await page.getByRole( 'button', { name: 'Import file' } ).click();
        await choose( 'imported.yaml', file );
        await expect( dialog ).toContainText( 'Nothing to import: the catalog already matches this file.' );
        await expect( dialog.getByRole( 'button', { name: 'Import' } ) ).toBeDisabled();
        await dialog.getByRole( 'button', { name: 'Cancel' } ).click();

        await page.goto( '/app/admin/audit' );
        await expect( page.getByRole( 'region', { name: 'Audit log' } ).getByRole( 'listitem' ).filter( { hasText: title } ) )
            .toContainText( `Ada Admin imported the path “${title}” from a file` );

        await page.goto( '/app/admin/catalog' );
        await row.getByRole( 'button', { name: `More for ${title}` } ).click();
        await page.getByRole( 'button', { name: 'Delete' } ).click();
        await expect( row ).toHaveCount( 0 );
    } );

    test( 'the admin pages don\'t exist for other users', async ( { page, api } ) => {
        await logIn( page, await api.signUp() );
        await expect( page.getByRole( 'link', { name: 'Admin' } ) ).toHaveCount( 0 );

        await page.goto( '/app/admin/reports' );
        await expect( page.getByRole( 'heading', { level: 1, name: 'Page not found' } ) ).toBeVisible();
    } );

    test( 'the overview counts users, sign-ups and the most followed paths', async ( { page, api } ) => {
        await api.signUp( 'Nina' );
        await logIn( page, ADMIN );
        await page.goto( '/app/admin' );

        await expect( page.getByRole( 'heading', { level: 1, name: 'Overview' } ) ).toBeVisible();
        await expect( page.getByRole( 'term' ).filter( { hasText: 'New sign-ups' } ).locator( '..' ) ).toContainText( /New sign-ups[1-9]/ );
        await expect( page.getByRole( 'region', { name: 'Sign-ups per day' } ).getByRole( 'listitem' ) ).toHaveCount( 30 );
        // The seeded learners follow the official DSA path.
        await expect( page.getByRole( 'region', { name: 'Most followed paths' } ) ).toContainText( 'Data Structures & AlgorithmsOfficial' );
    } );

    test( 'a superadmin finds a user, promotes and demotes them, then removes the account', async ( { page, api, browser } ) => {
        const uma = await api.signUp( 'Uma' );

        await logIn( page, ADMIN );
        await page.goto( '/app/admin' );
        await page.getByRole( 'navigation', { name: 'Admin', exact: true } ).getByRole( 'link', { name: 'Users' } ).click();
        await expect( page ).toHaveURL( '/app/admin/users' );

        await page.getByRole( 'searchbox', { name: 'Search users' } ).fill( uma.email );
        const row = page.getByRole( 'row', { name: new RegExp( uma.email ) } );

        await expect( page.getByRole( 'region', { name: 'Users' } ).getByRole( 'row' ) ).toHaveCount( 2 );
        await expect( row ).toContainText( 'Uma Tester' );
        await expect( row ).toContainText( 'UserNot verified' );
        await expect( row ).toContainText( /Today$/ );

        await row.getByRole( 'button', { name: `More for ${uma.email}` } ).click();
        await page.getByRole( 'button', { name: 'Make superadmin' } ).click();
        await expect( row ).toContainText( 'Superadmin' );

        // Uma sees Admin at her next login.
        const umaContext = await browser.newContext();
        const umaPage = await umaContext.newPage();

        await logIn( umaPage, uma );
        await expect( umaPage.getByRole( 'navigation', { name: 'Admin and settings' } ).getByRole( 'link', { name: 'Admin' } ) ).toBeVisible();
        await umaContext.close();

        await row.getByRole( 'button', { name: `More for ${uma.email}` } ).click();
        await page.getByRole( 'button', { name: 'Make normal user' } ).click();
        await expect( row ).toContainText( 'UserNot verified' );

        await row.getByRole( 'button', { name: `More for ${uma.email}` } ).click();
        await page.getByRole( 'button', { name: 'Remove account' } ).click();
        const dialog = page.getByRole( 'dialog', { name: 'Remove Uma Tester?' } );

        await dialog.getByLabel( 'Type their email to confirm' ).fill( uma.email );
        await dialog.getByRole( 'button', { name: 'Remove account' } ).click();
        await expect( dialog ).toBeHidden();
        await expect( page.getByText( 'No users match.' ) ).toBeVisible();

        // The account is gone.
        await expect( api.logIn( uma.email ) ).rejects.toThrow();
    } );

    test( 'a superadmin finds an organization by a member\'s email and looks inside, without changing it', async ( { page } ) => {
        await logIn( page, ADMIN );
        await page.goto( '/app/admin' );
        await page.getByRole( 'navigation', { name: 'Admin', exact: true } ).getByRole( 'link', { name: 'Organizations' } ).click();
        await expect( page ).toHaveURL( '/app/admin/organizations' );

        await page.getByRole( 'searchbox', { name: 'Search organizations' } ).fill( 'bob@example.com' );
        const row = page.getByRole( 'region', { name: 'Organizations' } ).getByRole( 'row', { name: /Acme Study Group/ } );

        await expect( row ).toContainText( 'Alice Walker' );
        await row.getByRole( 'link', { name: 'Acme Study Group' } ).click();
        await expect( page.getByRole( 'heading', { level: 1, name: 'Acme Study Group' } ) ).toBeVisible();
        await expect( page.getByText( 'Bob Singh' ) ).toBeVisible();
        await expect( page.getByRole( 'button', { name: 'Rename' } ) ).toHaveCount( 0 );
    } );

    test( 'the audit log shows who promoted a user, under Users', async ( { page, api } ) => {
        const vera = await api.signUp( 'Vera' );

        await logIn( page, ADMIN );
        await page.goto( '/app/admin/users' );
        await page.getByRole( 'searchbox', { name: 'Search users' } ).fill( vera.email );
        const row = page.getByRole( 'row', { name: new RegExp( vera.email ) } );

        await row.getByRole( 'button', { name: `More for ${vera.email}` } ).click();
        await page.getByRole( 'button', { name: 'Make superadmin' } ).click();
        await expect( row ).toContainText( 'Superadmin' );

        await page.getByRole( 'navigation', { name: 'Admin', exact: true } ).getByRole( 'link', { name: 'Audit log' } ).click();
        await page.getByRole( 'combobox', { name: 'Area' } ).selectOption( 'Users' );
        // Other tests promote users too, at the same time.
        await expect( page.getByRole( 'region', { name: 'Audit log' } ).getByRole( 'listitem' ).filter( { hasText: vera.email } ) )
            .toContainText( `Ada Admin made ${vera.email} a superadmin` );
    } );
} );
