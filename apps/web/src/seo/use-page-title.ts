import { useEffect } from 'react';

/** Added to every page's title: "Log in – Gradiaqo". */
export const SITE_NAME = 'Gradiaqo';

/**
 * Names the page in the browser tab and for search engines (which read it once the app has run), and makes its
 * address the canonical one, so /login isn't taken for a copy of the homepage. Leaving the page puts back what
 * index.html had.
 */
export function usePageTitle( title: string ): void {
    useEffect( () => {
        const canonical = document.querySelector<HTMLLinkElement>( 'link[rel="canonical"]' );
        const before = { title: document.title, canonical: canonical?.href };

        document.title = `${title} – ${SITE_NAME}`;
        canonical?.setAttribute( 'href', `${__SITE_URL__}${window.location.pathname}` );

        return () => {
            document.title = before.title;
            if ( canonical && before.canonical ) {
                canonical.setAttribute( 'href', before.canonical );
            }
        };
    }, [ title ] );
}
