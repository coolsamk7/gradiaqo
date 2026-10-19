import { expect, logIn, SEEDED, test } from './support/fixtures.ts';

test.describe( 'My paths', () => {
    // A new user each time, so other tests' view of the catalog doesn't change. Paths stay private for the same reason.
    test( 'builds a path: modules, topics, own items and catalog items, then studies it', async ( { page, api } ) => {
        await logIn( page, await api.signUp() );
        await page.getByRole( 'navigation', { name: 'Main' } ).getByRole( 'link', { name: 'My paths' } ).click();
        await expect( page.getByRole( 'heading', { name: 'No paths here yet' } ) ).toBeVisible();

        await page.getByRole( 'button', { name: 'New path' } ).click();
        const dialog = page.getByRole( 'dialog', { name: 'New path' } );

        await dialog.getByLabel( 'Title' ).fill( 'Graph Practice' );
        await dialog.getByLabel( 'Description (optional)' ).fill( 'BFS, DFS and friends.' );
        await dialog.getByRole( 'button', { name: 'Create path' } ).click();
        await expect( page ).toHaveURL( /\/app\/my-paths\/[\da-f-]{36}\/[\da-f-]{36}$/ );
        await expect( page.getByRole( 'heading', { level: 1, name: 'Graph Practice' } ) ).toBeVisible();
        await expect( page.getByRole( 'switch', { name: 'Public' } ) ).not.toBeChecked();

        const structure = page.getByRole( 'region', { name: 'Structure' } );

        await structure.getByRole( 'button', { name: 'Add a module' } ).click();
        await structure.getByLabel( 'Module title' ).fill( 'Traversal' );
        await structure.getByLabel( 'Module title' ).press( 'Enter' );
        await expect( page.getByRole( 'heading', { name: 'Module · Traversal' } ) ).toBeVisible();

        await structure.getByRole( 'button', { name: 'Add a topic to Traversal' } ).click();
        await structure.getByLabel( 'Topic title' ).fill( 'Basics' );
        await structure.getByLabel( 'Topic title' ).press( 'Enter' );
        await expect( page.getByRole( 'heading', { name: 'Topic · Basics' } ) ).toBeVisible();

        // An item from the catalog.
        const items = page.getByRole( 'region', { name: /^Items · / } );

        await items.getByRole( 'button', { name: 'Link from catalog' } ).click();
        const link = page.getByRole( 'dialog', { name: 'Link items from the catalog' } );

        await link.getByRole( 'searchbox', { name: 'Search the catalog' } ).fill( 'Two Sum' );
        await link.getByRole( 'button', { name: 'Link Two Sum', exact: true } ).click();
        await expect( link.getByText( '1 linked to Basics' ) ).toBeVisible();
        await link.getByRole( 'button', { name: 'Done' } ).click();

        // And one of the user's own.
        await items.getByRole( 'button', { name: 'New item' } ).click();
        const form = page.getByRole( 'region', { name: 'New item' } );

        await form.getByLabel( 'Type' ).selectOption( 'note' );
        await form.getByLabel( 'Title' ).fill( 'BFS cheat sheet' );
        await form.getByLabel( 'Note' ).fill( 'Queue, visited set, level by level.' );
        await form.getByRole( 'button', { name: 'Add item' } ).click();
        await expect( form ).toBeHidden();

        await expect( items.getByRole( 'heading', { name: 'Items · 2' } ) ).toBeVisible();
        await expect( items.getByRole( 'listitem' ) ).toContainText( [ 'Two SumProblem · Easy · from the catalog', 'BFS cheat sheetNote · your item' ] );
        await items.getByRole( 'switch', { name: 'BFS cheat sheet is optional' } ).click();
        await expect( items.getByRole( 'switch', { name: 'BFS cheat sheet is optional' } ) ).toBeChecked();

        // Changes are saved: they're still there after a reload.
        await page.reload();
        await expect( structure.getByRole( 'button', { name: 'Basics (2 items)' } ) ).toBeVisible();
        await expect( items.getByRole( 'switch', { name: 'BFS cheat sheet is optional' } ) ).toBeChecked();

        // The creator follows the path: it's in Browse paths under Yours, ready to study.
        await page.goto( '/app/catalog?source=mine' );
        await page.getByRole( 'link', { name: 'Continue Graph Practice' } ).click();
        await expect( page.getByRole( 'heading', { level: 1, name: 'Graph Practice' } ) ).toBeVisible();
        await expect( page.getByRole( 'heading', { name: 'Traversal' } ) ).toBeVisible();
    } );

    test( 'reorders and deletes, and explains a title that is taken', async ( { page, api } ) => {
        await logIn( page, await api.signUp() );
        await page.goto( '/app/my-paths' );

        for ( const step of [ 'create', 'again' ] ) {
            await page.getByRole( 'button', { name: 'New path' } ).click();
            await page.getByRole( 'dialog' ).getByLabel( 'Title' ).fill( 'Arrays' );
            await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Create path' } ).click();
            if ( step === 'create' ) {
                await expect( page.getByRole( 'heading', { level: 1, name: 'Arrays' } ) ).toBeVisible();
                await page.getByRole( 'link', { name: 'Back to my paths' } ).click();
            }
        }
        await expect( page.getByRole( 'dialog' ).getByRole( 'alert' ) ).toHaveText( 'You already have a path with this title. Try another.' );
        await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Cancel' } ).click();
        await page.getByRole( 'link', { name: 'Edit Arrays' } ).click();
        await expect( page.getByRole( 'heading', { level: 1, name: 'Arrays' } ) ).toBeVisible();

        const structure = page.getByRole( 'region', { name: 'Structure' } );

        for ( const module of [ 'Basics', 'Two Pointers' ] ) {
            await structure.getByRole( 'button', { name: 'Add a module' } ).click();
            await structure.getByLabel( 'Module title' ).fill( module );
            await structure.getByLabel( 'Module title' ).press( 'Enter' );
            await expect( page.getByRole( 'heading', { name: `Module · ${module}` } ) ).toBeVisible();
        }

        await structure.getByRole( 'button', { name: 'More for Two Pointers' } ).click();
        await structure.getByRole( 'button', { name: 'Move up' } ).click();
        await expect( structure.getByRole( 'list', { name: 'Modules' } ).getByRole( 'button', { name: /^(Basics|Two Pointers)$/ } ) )
            .toHaveText( [ 'Two Pointers', 'Basics' ] );

        await page.getByRole( 'button', { name: 'Delete module' } ).click();
        await page.getByRole( 'group', { name: 'Delete this module?' } ).getByRole( 'button', { name: 'Delete' } ).click();
        await expect( structure.getByRole( 'button', { name: 'Two Pointers', exact: true } ) ).toBeHidden();

        await page.getByRole( 'button', { name: 'Delete path' } ).click();
        await page.getByRole( 'group', { name: 'Delete this path?' } ).getByRole( 'button', { name: 'Delete' } ).click();
        await expect( page ).toHaveURL( /\/app\/my-paths\?org=/ );
        await expect( page.getByRole( 'heading', { name: 'No paths here yet' } ) ).toBeVisible();
    } );

    test( 'Alice also builds paths for the organization she runs', async ( { page } ) => {
        await logIn( page, SEEDED.alice );
        await page.goto( '/app/my-paths' );

        await expect( page.getByRole( 'heading', { level: 2, name: 'Alice\'s Favourite Problems' } ) ).toBeVisible();
        await page.getByRole( 'button', { name: 'Acme Study Group' } ).click();
        await expect( page.getByRole( 'heading', { level: 2, name: 'Interview Sprint' } ) ).toBeVisible();
        await expect( page.getByText( /for the members of Acme Study Group/ ) ).toBeVisible();
    } );
} );
