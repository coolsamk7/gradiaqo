import { expect, test } from './support/fixtures.ts';

test.describe( 'Homepage', () => {
    test.beforeEach( async ( { page } ) => {
        await page.goto( '/' );
    } );

    test( 'introduces Gradiaqo', async ( { page } ) => {
        await expect( page ).toHaveTitle( /Gradiaqo/ );
        await expect( page.getByRole( 'heading', { level: 1 } ) ).toHaveText( 'Study with a plan. See your progress every day.' );
        await expect( page.getByRole( 'heading', { level: 2, name: 'Everything your study plan needs' } ) ).toBeVisible();
        await expect( page.getByRole( 'heading', { level: 2, name: 'Three steps to a study habit' } ) ).toBeVisible();
        await expect( page.getByRole( 'heading', { level: 2, name: 'Ready to make your study time count?' } ) ).toBeVisible();
    } );

    test( 'tells search engines what to crawl, and names each public page', async ( { page, request } ) => {
        const robots = await request.get( '/robots.txt' );

        expect( await robots.text() ).toContain( 'Disallow: /app\n' );
        expect( await robots.text() ).toMatch( /\nSitemap: http\S+\/sitemap\.xml\n/ );
        expect( await ( await request.get( '/sitemap.xml' ) ).text() ).toMatch( /<loc>http\S+\/signup<\/loc>/ );
        await expect( page.locator( 'meta[property="og:image"]' ) ).toHaveAttribute( 'content', /\/og-image\.png$/ );

        await page.getByRole( 'link', { name: 'Log in' } ).first().click();
        await expect( page ).toHaveTitle( 'Log in – Gradiaqo' );
        await expect( page.locator( 'link[rel="canonical"]' ) ).toHaveAttribute( 'href', /\/login$/ );
    } );

    test( 'links to the sections of the page', async ( { page } ) => {
        const nav = page.getByRole( 'navigation', { name: 'Main' } );

        await nav.getByRole( 'link', { name: 'How it works' } ).click();
        await expect( page ).toHaveURL( /#how-it-works$/ );
        await expect( page.getByRole( 'heading', { name: 'Three steps to a study habit' } ) ).toBeInViewport();

        await nav.getByRole( 'link', { name: 'Features' } ).click();
        await expect( page ).toHaveURL( /#features$/ );
        await expect( page.getByRole( 'heading', { name: 'Everything your study plan needs' } ) ).toBeInViewport();

        await page.getByRole( 'link', { name: 'See how it works' } ).click();
        await expect( page ).toHaveURL( /#how-it-works$/ );
    } );

    test( 'has a skip link for keyboard users', async ( { page } ) => {
        await page.keyboard.press( 'Tab' );
        await expect( page.getByRole( 'link', { name: 'Skip to content' } ) ).toBeFocused();
        await page.keyboard.press( 'Enter' );
        await expect( page ).toHaveURL( /#main$/ );
    } );

    test( 'every "get started" button opens the signup page', async ( { page } ) => {
        for ( const name of [ 'Get started', 'Create your account' ] ) {
            const links = page.getByRole( 'link', { name, exact: true } );

            for ( let i = 0; i < await links.count(); i++ ) {
                await page.goto( '/' );
                await links.nth( i ).click();
                await expect( page ).toHaveURL( '/signup' );
            }
        }
    } );

    test( 'the header opens the login page, and the logo comes back home', async ( { page } ) => {
        await page.getByRole( 'navigation', { name: 'Main' } ).getByRole( 'link', { name: 'Log in' } ).click();
        await expect( page ).toHaveURL( '/login' );

        await page.goto( '/#features' );
        await page.getByRole( 'link', { name: 'Gradiaqo home' } ).click();
        await expect( page ).toHaveURL( '/' );
    } );
} );

test.describe( 'Unknown pages', () => {
    for ( const url of [ '/nope', '/app/nope', '/login/extra' ] ) {
        test( `${url} shows "Page not found" with a way home`, async ( { page } ) => {
            await page.goto( url );
            await expect( page.getByRole( 'heading', { level: 1, name: 'Page not found' } ) ).toBeVisible();
            await page.getByRole( 'link', { name: 'Back to home' } ).click();
            await expect( page ).toHaveURL( '/' );
        } );
    }
} );
