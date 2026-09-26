import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { FEATURES, PATH_PERCENT, STEPS, WEEK } from './content.tsx';
import { HomePage } from './HomePage.tsx';

describe( 'HomePage', () => {
    beforeEach( () => {
        render( <MemoryRouter><HomePage /></MemoryRouter> );
    } );

    it( 'has a header, main content and footer, with a skip link to the content', () => {
        expect( screen.getByRole( 'banner' ) ).toBeInTheDocument();
        expect( screen.getByRole( 'main' ) ).toHaveAttribute( 'id', 'main' );
        expect( screen.getByRole( 'contentinfo' ) ).toBeInTheDocument();
        expect( screen.getByRole( 'link', { name: 'Skip to content' } ) ).toHaveAttribute( 'href', '#main' );
    } );

    it( 'leads with one main heading, then a heading per section', () => {
        expect( screen.getByRole( 'heading', { level: 1 } ) ).toHaveTextContent( 'Study with a plan. See your progress every day.' );
        expect( screen.getAllByRole( 'heading', { level: 2 } ).map( ( heading ) => heading.textContent ) ).toEqual( [
            'Everything your study plan needs',
            'Three steps to a study habit',
            'Ready to make your study time count?',
        ] );
    } );

    it( 'links the header to the sections, logging in and signing up', () => {
        const nav = within( screen.getByRole( 'navigation', { name: 'Main' } ) );

        expect( nav.getByRole( 'link', { name: 'Features' } ) ).toHaveAttribute( 'href', '#features' );
        expect( nav.getByRole( 'link', { name: 'How it works' } ) ).toHaveAttribute( 'href', '#how-it-works' );
        expect( nav.getByRole( 'link', { name: 'Log in' } ) ).toHaveAttribute( 'href', '/login' );
        expect( nav.getByRole( 'link', { name: 'Get started' } ) ).toHaveAttribute( 'href', '/signup' );
        expect( screen.getByRole( 'link', { name: 'StudyLog home' } ) ).toHaveAttribute( 'href', '/' );
    } );

    it( 'sends every call to action to sign up, and the secondary one to the steps', () => {
        expect( screen.getAllByRole( 'link', { name: /Get started|Create your account/ } ).map( ( link ) => link.getAttribute( 'href' ) ) )
            .toEqual( [ '/signup', '/signup', '/signup' ] );
        expect( screen.getByRole( 'link', { name: 'See how it works' } ) ).toHaveAttribute( 'href', '#how-it-works' );
    } );

    it( 'lists every feature with its description', () => {
        const section = within( screen.getByRole( 'region', { name: 'Everything your study plan needs' } ) );
        const items = section.getAllByRole( 'listitem' );

        expect( items ).toHaveLength( 6 );
        FEATURES.forEach( ( feature, index ) => {
            expect( within( items[index] ).getByRole( 'heading', { level: 3 } ) ).toHaveTextContent( feature.title );
            expect( items[index] ).toHaveTextContent( feature.text );
        } );
        expect( section.getByRole( 'heading', { name: 'Learning paths' } ) ).toBeInTheDocument();
    } );

    it( 'shows the three steps in order', () => {
        const steps = within( screen.getByRole( 'region', { name: 'Three steps to a study habit' } ) ).getAllByRole( 'listitem' );

        expect( steps.map( ( step ) => within( step ).getByRole( 'heading' ).textContent ) ).toEqual( STEPS.map( ( step ) => step.title ) );
        expect( steps.map( ( step ) => step.textContent?.charAt( 0 ) ) ).toEqual( [ '1', '2', '3' ] );
    } );

    it( 'shows the footer links and the current year', () => {
        const footer = within( screen.getByRole( 'contentinfo' ) );

        expect( footer.getByRole( 'link', { name: 'Features' } ) ).toHaveAttribute( 'href', '#features' );
        expect( footer.getByRole( 'link', { name: 'Log in' } ) ).toHaveAttribute( 'href', '/login' );
        expect( footer.getByText( `© ${new Date().getFullYear()} StudyLog` ) ).toBeInTheDocument();
    } );
} );

describe( 'DashboardPreview', () => {
    beforeEach( () => {
        render( <MemoryRouter><HomePage /></MemoryRouter> );
    } );

    it( 'summarizes the example for screen readers and hides the drawing', () => {
        const preview = screen.getByRole( 'figure' );

        expect( PATH_PERCENT ).toBe( 63 ); // 5 of 8 items done
        expect( within( preview ).getByText(
            'Example dashboard: Data Structures & Algorithms 63% complete, a 5-day streak and 45 minutes studied today.',
        ) ).toBeInTheDocument();
        expect( preview.querySelector( '[aria-hidden="true"]' ) ).toHaveTextContent( 'Data Structures & Algorithms' );
    } );

    it( 'fills the progress bar and marks finished modules', () => {
        const drawing = screen.getByRole( 'figure' ).querySelector( '[aria-hidden="true"]' )!;

        expect( drawing ).toHaveTextContent( '63%' );
        expect( drawing ).toHaveTextContent( '3/3' );
        expect( drawing ).toHaveTextContent( '2/3' );
        expect( drawing ).toHaveTextContent( '0/2' );
        expect( drawing.querySelector( '[style*="width"]' ) ).toHaveStyle( { width: '63%' } );
    } );

    it( 'scales the week\'s bars to the busiest day, keeping a sliver for days without study', () => {
        const bars = [ ...screen.getByRole( 'figure' ).querySelectorAll<HTMLElement>( '[style*="height"]' ) ];
        const busiest = Math.max( ...WEEK );

        expect( bars ).toHaveLength( 7 );
        expect( bars.map( ( bar ) => bar.style.height ) ).toEqual( WEEK.map( ( minutes ) =>
            `${Math.max( 6, ( minutes / busiest ) * 100 )}%` ) );
        expect( bars[3].style.height ).toBe( '100%' );
        expect( bars[6].style.height ).toBe( '6%' );
    } );
} );
