import { renderHook } from '@testing-library/react';

import { usePageTitle } from './use-page-title.ts';

describe( 'usePageTitle', () => {
    let canonical: HTMLLinkElement;

    beforeEach( () => {
        document.title = 'Gradiaqo – Study plans and progress tracking';
        canonical = document.createElement( 'link' );
        canonical.rel = 'canonical';
        canonical.href = 'https://site.test/';
        document.head.append( canonical );
        window.history.pushState( {}, '', '/login' );
    } );

    afterEach( () => {
        canonical.remove();
        window.history.pushState( {}, '', '/' );
    } );

    it( 'names the page and makes its address canonical, then puts back what was there', () => {
        const { rerender, unmount } = renderHook( ( { title } ) => usePageTitle( title ), { initialProps: { title: 'Log in' } } );

        expect( document.title ).toBe( 'Log in – Gradiaqo' );
        expect( canonical.href ).toBe( 'https://site.test/login' );

        rerender( { title: 'Reset your password' } );
        expect( document.title ).toBe( 'Reset your password – Gradiaqo' );

        unmount();
        expect( document.title ).toBe( 'Gradiaqo – Study plans and progress tracking' );
        expect( canonical.href ).toBe( 'https://site.test/' );
    } );

    it( 'still names the page without a canonical link', () => {
        canonical.remove();
        const { unmount } = renderHook( () => usePageTitle( 'Page not found' ) );

        expect( document.title ).toBe( 'Page not found – Gradiaqo' );
        unmount();
        expect( document.title ).toBe( 'Gradiaqo – Study plans and progress tracking' );
    } );
} );
