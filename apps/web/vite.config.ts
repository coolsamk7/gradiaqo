import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';

import { robotsTxt, sitemapXml } from './src/seo/site-files.ts';

/**
 * What search engines and link previews read without running the app: the site's address in index.html (canonical
 * link, Open Graph tags), and robots.txt and sitemap.xml, built for that address and also served by the dev server.
 */
function siteFiles( site: string ): Plugin {
    const files: Record<string, () => string> = {
        '/robots.txt': () => robotsTxt( site ),
        '/sitemap.xml': () => sitemapXml( site ),
    };

    return {
        name: 'gradiaqo-site-files',
        transformIndexHtml: ( html ) => html.replaceAll( '%SITE_URL%', site ),
        configureServer( server ) {
            server.middlewares.use( ( request, response, next ) => {
                const file = files[request.url ?? ''];

                if ( !file ) {
                    next();

                    return;
                }
                response.setHeader( 'Content-Type', request.url === '/robots.txt' ? 'text/plain' : 'application/xml' );
                response.end( file() );
            } );
        },
        generateBundle() {
            for ( const [ path, file ] of Object.entries( files ) ) {
                this.emitFile( { type: 'asset', fileName: path.slice( 1 ), source: file() } );
            }
        },
    };
}

export default defineConfig( ( { mode } ) => {
    const env = loadEnv( mode, import.meta.dirname, 'VITE_' );
    const api = env.VITE_API_URL ?? 'http://localhost:3000';
    // The site's own address. In production the app and the API share it (deploy/Caddyfile), so VITE_API_URL is it;
    // VITE_SITE_URL overrides that.
    const site = env.VITE_SITE_URL ?? ( mode === 'production' ? api : 'http://localhost:5173' );

    return {
        plugins: [ react(), siteFiles( site ) ],
        define: {
            // The API's base URL (see src/vite-env.d.ts). Set VITE_API_URL in apps/web/.env to change it.
            __API_URL__: JSON.stringify( api ),
            __SITE_URL__: JSON.stringify( site ),
        },
        // 5173 is in the API's default CORS_ORIGINS; fail rather than silently move to another port.
        server: { port: 5173, strictPort: true },
    };
} );
