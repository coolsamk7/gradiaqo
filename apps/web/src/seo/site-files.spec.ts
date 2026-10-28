import { PUBLIC_PAGES, robotsTxt, sitemapXml } from './site-files.ts';

describe( 'site files', () => {
    it( 'lets search engines crawl the public pages, not the app, and points them to the sitemap', () => {
        expect( robotsTxt( 'https://gradiaqo.com' ) ).toBe( [
            'User-agent: *',
            'Disallow: /app',
            'Disallow: /verify-email',
            'Disallow: /reset-password',
            '',
            'Sitemap: https://gradiaqo.com/sitemap.xml',
            '',
        ].join( '\n' ) );
    } );

    it( 'lists the public pages in the sitemap, at the site\'s address', () => {
        const sitemap = sitemapXml( 'https://gradiaqo.com' );

        expect( sitemap ).toMatch( /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">\n/ );
        expect( [ ...sitemap.matchAll( /<loc>([^<]+)<\/loc>/g ) ].map( ( match ) => match[1] ) )
            .toEqual( [ 'https://gradiaqo.com/', 'https://gradiaqo.com/signup', 'https://gradiaqo.com/login' ] );
        expect( PUBLIC_PAGES ).not.toContain( '/app' );
        expect( sitemap.endsWith( '</urlset>\n' ) ).toBe( true );
    } );
} );
