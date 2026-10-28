/* robots.txt and sitemap.xml, made at build time with the site's address (see vite.config.ts). */

/** The pages search engines should list: the public ones, most important first. */
export const PUBLIC_PAGES = [ '/', '/signup', '/login' ];

/** Pages behind a login, or only reached from an email: nothing for a search engine there. */
const PRIVATE_PATHS = [ '/app', '/verify-email', '/reset-password' ];

/** Crawl everything public, and say where the sitemap is. `site` is the origin, e.g. https://gradiaqo.com. */
export function robotsTxt( site: string ): string {
    return [
        'User-agent: *',
        ...PRIVATE_PATHS.map( ( path ) => `Disallow: ${path}` ),
        '',
        `Sitemap: ${site}/sitemap.xml`,
        '',
    ].join( '\n' );
}

export function sitemapXml( site: string ): string {
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...PUBLIC_PAGES.map( ( path ) => `  <url><loc>${site}${path}</loc></url>` ),
        '</urlset>',
        '',
    ].join( '\n' );
}
