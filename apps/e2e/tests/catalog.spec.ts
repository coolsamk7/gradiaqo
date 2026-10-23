import { expect, logIn, SEEDED, test } from './support/fixtures.ts';

test.describe( 'Browse paths', () => {
    test( 'lists the paths Alice can see, with what is in them and the way in', async ( { page } ) => {
        await logIn( page, SEEDED.alice );
        await page.getByRole( 'navigation', { name: 'Main' } ).getByRole( 'link', { name: 'Browse paths' } ).click();
        await expect( page ).toHaveURL( '/app/catalog' );

        const paths = page.getByRole( 'list', { name: 'Learning paths' } );
        const dsa = paths.getByRole( 'listitem' ).filter( { has: page.getByRole( 'heading', { name: 'Data Structures & Algorithms' } ) } );

        await expect( paths.getByRole( 'heading', { level: 2 } ) ).toHaveText( [
            'Data Structures & Algorithms', 'System Design Fundamentals', 'Alice\'s Favourite Problems', 'Interview Sprint',
        ] );
        await expect( dsa ).toContainText( 'Official' );
        await expect( dsa ).toContainText( 'Enrolled' );
        await expect( dsa.getByRole( 'list', { name: 'Contents' } ) ).toContainText( '4 modules' );
        // Enrolled: Continue opens the path.
        await dsa.getByRole( 'link', { name: 'Continue Data Structures & Algorithms' } ).click();
        await expect( page.getByRole( 'heading', { level: 1, name: 'Data Structures & Algorithms' } ) ).toBeVisible();
    } );

    test( 'filters by source and searches by title, kept in the URL', async ( { page } ) => {
        await logIn( page, SEEDED.alice );
        await page.goto( '/app/catalog' );
        const headings = page.getByRole( 'list', { name: 'Learning paths' } ).getByRole( 'heading', { level: 2 } );

        await page.getByRole( 'button', { name: 'Your organizations' } ).click();
        await expect( page ).toHaveURL( '/app/catalog?source=organizations' );
        await expect( headings ).toHaveText( [ 'Interview Sprint' ] );

        await page.getByRole( 'button', { name: 'Official' } ).click();
        await page.getByRole( 'searchbox', { name: 'Search paths' } ).fill( 'design' );
        await expect( page ).toHaveURL( '/app/catalog?source=official&q=design' );
        await expect( headings ).toHaveText( [ 'System Design Fundamentals' ] );

        await page.getByRole( 'searchbox', { name: 'Search paths' } ).fill( 'graph theory' );
        await expect( page.getByRole( 'heading', { name: 'No paths match “graph theory”' } ) ).toBeVisible();

        // Reloading keeps the filter and the search.
        await page.reload();
        await expect( page.getByRole( 'button', { name: 'Official' } ) ).toHaveAttribute( 'aria-pressed', 'true' );
        await expect( page.getByRole( 'searchbox', { name: 'Search paths' } ) ).toHaveValue( 'graph theory' );
    } );

    test( 'a new user sees official paths with View path', async ( { page, api } ) => {
        await logIn( page, await api.signUp() );
        await page.goto( '/app/catalog' );

        const dsa = page.getByRole( 'listitem' ).filter( { has: page.getByRole( 'heading', { name: 'Data Structures & Algorithms' } ) } );

        await expect( dsa ).not.toContainText( 'Enrolled' );
        await expect( dsa.getByRole( 'link', { name: 'View Data Structures & Algorithms' } ) ).toHaveAttribute( 'href', /\/app\/catalog\/[\da-f-]{36}$/ );
        // Alice's public path is a community path for everyone else.
        await expect( page.getByRole( 'listitem' ).filter( { has: page.getByRole( 'heading', { name: 'Alice\'s Favourite Problems' } ) } ) )
            .toContainText( 'Community' );
    } );

    test( 'a community path can be reported once, from its preview', async ( { page, api } ) => {
        // A new user, so the report is theirs alone.
        const user = await api.signUp();

        await logIn( page, user );
        await page.goto( '/app/catalog?source=community' );
        await page.getByRole( 'link', { name: 'View Alice\'s Favourite Problems' } ).click();
        await expect( page.getByRole( 'heading', { level: 1, name: 'Alice\'s Favourite Problems' } ) ).toBeVisible();

        const about = page.getByRole( 'region', { name: 'About' } );

        await about.getByRole( 'button', { name: 'Report this path' } ).click();
        const dialog = page.getByRole( 'dialog', { name: 'Report this path' } );

        await dialog.getByRole( 'radio', { name: 'Something else' } ).check();
        await dialog.getByLabel( 'Details (optional)' ).fill( 'Two of the links point to paid courses.' );
        await dialog.getByRole( 'button', { name: 'Send report' } ).click();
        await expect( about.getByRole( 'status' ) ).toHaveText( 'Thanks for telling us. An admin will review this path.' );

        // Again, after a reload: the API remembers it.
        await page.reload();
        await about.getByRole( 'button', { name: 'Report this path' } ).click();
        await dialog.getByRole( 'radio', { name: 'Spam or advertising' } ).check();
        await dialog.getByRole( 'button', { name: 'Send report' } ).click();
        await expect( about.getByRole( 'status' ) ).toHaveText( 'You already reported this path. An admin will review it.' );
    } );

    test( 'your own public path has no report link', async ( { page } ) => {
        await logIn( page, SEEDED.alice );
        await page.goto( '/app/catalog?source=mine' );
        await page.getByRole( 'link', { name: 'View Alice\'s Favourite Problems' } ).click();
        await expect( page.getByRole( 'region', { name: 'About' } ) ).toContainText( 'Public' );
        await expect( page.getByRole( 'button', { name: 'Report this path' } ) ).toBeHidden();
    } );
} );
