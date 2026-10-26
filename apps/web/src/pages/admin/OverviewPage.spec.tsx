import type { PlatformOverviewJson } from '@studylog/schemas';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, loggedIn, mockApi, pending, USER } from '../../test/api.ts';
import { uuid } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';

type Handlers = Parameters<typeof mockApi>[0];

const ADMIN = { ...USER, platformRole: 'superadmin' };
const days = ( counts: Record<number, number> = {} ) =>
    Array.from( { length: 30 }, ( _, index ) => ( { date: `2026-10-${String( index + 1 ).padStart( 2, '0' )}`, count: counts[index] ?? 0 } ) );

const OVERVIEW: PlatformOverviewJson = {
    users: { total: 42, verified: 30, superadmins: 1 },
    activeUsers: { last7Days: 12, last30Days: 25 },
    signups: { last30Days: 6, perDay: days( { 3: 1, 10: 4, 29: 1 } ) },
    study: { learners: 9, sessions: 1, minutes: 135 },
    topPaths: [
        { id: uuid( 1 ), title: 'Data Structures & Algorithms', official: true, enrollments: 20 },
        { id: uuid( 2 ), title: 'Alice\'s Favourite Problems', official: false, enrollments: 1 },
    ],
};

function api( handlers: Handlers = {} ) {
    return mockApi( {
        ...loggedIn,
        'GET /auth/me': () => json( 200, ADMIN ),
        'GET /admin/reports': () => json( 200, { items: [], total: 2 } ),
        'GET /admin/overview': () => json( 200, OVERVIEW ),
        ...handlers,
    } );
}

describe( 'OverviewPage', () => {
    it( 'is the Admin landing page, with the admin sections', async () => {
        api();
        renderApp( '/app/admin' );

        expect( await screen.findByRole( 'heading', { level: 1, name: 'Overview' } ) ).toBeInTheDocument();
        const nav = within( screen.getByRole( 'navigation', { name: 'Admin' } ) );

        await nav.findByRole( 'link', { name: 'Reports · 2' } );

        expect( nav.getAllByRole( 'link' ).map( ( link ) => [ link.textContent, link.getAttribute( 'href' ) ] ) ).toEqual( [
            [ 'Overview', '/app/admin' ],
            [ 'Catalog', '/app/admin/catalog' ],
            [ 'Reports · 2', '/app/admin/reports' ],
            [ 'Users', '/app/admin/users' ],
            [ 'Organizations', '/app/admin/organizations' ],
            [ 'Audit log', '/app/admin/audit' ],
        ] );
        expect( nav.getByRole( 'link', { name: 'Overview' } ) ).toHaveAttribute( 'aria-current', 'page' );
        expect( nav.getByRole( 'link', { name: 'Catalog' } ) ).not.toHaveAttribute( 'aria-current' );
    } );

    it( 'shows accounts, activity, sign-ups and study at a glance', async () => {
        api();
        renderApp( '/app/admin' );

        const tile = async ( label: string ) =>
            ( await screen.findAllByRole( 'term' ) ).find( ( term ) => term.textContent === label )?.parentElement;

        expect( await tile( 'Users' ) ).toHaveTextContent( 'Users4230 verified · 1 superadmin' );
        expect( await tile( 'Active this week' ) ).toHaveTextContent( '1225 in 30 days' );
        expect( await tile( 'New sign-ups' ) ).toHaveTextContent( '6In the last 30 days' );
        expect( await tile( 'Studying' ) ).toHaveTextContent( '91 session · 2h 15m' );
        expect( screen.queryByText( 'Loading the overview…' ) ).not.toBeInTheDocument();
        expect( screen.queryByRole( 'button', { name: 'Try again' } ) ).not.toBeInTheDocument();
    } );

    it( 'charts sign-ups per day', async () => {
        api();
        renderApp( '/app/admin' );

        const chart = await screen.findByRole( 'region', { name: 'Sign-ups per day' } );
        const bars = within( chart ).getAllByRole( 'listitem' );

        expect( chart ).toHaveTextContent( '6 sign-ups, the most on Oct 11 (4).' );
        expect( bars ).toHaveLength( 30 );
        expect( bars[10] ).toHaveTextContent( 'Oct 11: 4' );
        expect( bars[10].firstElementChild ).toHaveStyle( { height: '100%' } );
        expect( bars[3].firstElementChild ).toHaveStyle( { height: '25%' } );
        expect( bars[0].firstElementChild ).not.toHaveAttribute( 'style' );
        // Days without sign-ups are a flat line, not a bar.
        expect( bars[0].firstElementChild?.className ).not.toBe( bars[3].firstElementChild?.className );
        expect( bars[3].firstElementChild?.className ).toBe( bars[10].firstElementChild?.className );
    } );

    it( 'lists the most followed paths', async () => {
        api();
        renderApp( '/app/admin' );

        const top = await screen.findByRole( 'region', { name: 'Most followed paths' } );

        expect( within( top ).getAllByRole( 'listitem' ).map( ( item ) => item.textContent ) ).toEqual( [
            'Data Structures & AlgorithmsOfficial20 learners',
            'Alice\'s Favourite ProblemsCommunity1 learner',
        ] );
        expect( within( top ).getByRole( 'link', { name: 'Data Structures & Algorithms' } ) ).toHaveAttribute( 'href', `/app/catalog/${uuid( 1 )}` );
    } );

    it( 'says when nothing has happened yet', async () => {
        api( {
            'GET /admin/overview': () => json( 200, { ...OVERVIEW, signups: { last30Days: 0, perDay: days() }, topPaths: [] } ),
        } );
        renderApp( '/app/admin' );

        expect( await screen.findByText( 'No sign-ups in the last 30 days.' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Nobody has enrolled in a path yet.' ) ).toBeInTheDocument();
    } );

    it( 'shows that it is loading', async () => {
        api( { 'GET /admin/overview': () => pending() } );
        renderApp( '/app/admin' );
        expect( await screen.findByText( 'Loading the overview…' ) ).toBeInTheDocument();
    } );

    it( 'retries after a load error', async () => {
        let answer = () => json( 500, { statusCode: 500, message: 'Boom' } );

        api( { 'GET /admin/overview': () => answer() } );
        const user = userEvent.setup();

        renderApp( '/app/admin' );
        const retry = await screen.findByRole( 'button', { name: 'Try again' } );

        answer = () => json( 200, OVERVIEW );
        await user.click( retry );
        expect( await screen.findByRole( 'region', { name: 'Most followed paths' } ) ).toBeInTheDocument();
    } );

    it( 'doesn\'t exist for anyone but superadmins', async () => {
        const { calls } = mockApi( loggedIn );

        renderApp( '/app/admin' );

        expect( await screen.findByRole( 'heading', { level: 1, name: 'Page not found' } ) ).toBeInTheDocument();
        expect( calls.some( ( call ) => call.path.startsWith( '/admin' ) ) ).toBe( false );
    } );
} );
