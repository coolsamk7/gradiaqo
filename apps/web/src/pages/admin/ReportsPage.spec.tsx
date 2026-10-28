import type { ReportJson } from '@studylog/schemas';
import { PathVisibility, ReportReason, ReportStatus } from '@studylog/schemas/enums';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, loggedIn, mockApi, noContent, pending, USER } from '../../test/api.ts';
import { uuid } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';

type Handlers = Parameters<typeof mockApi>[0];

const DAY = 24 * 60 * 60 * 1000;
const ADMIN = { ...USER, platformRole: 'superadmin' };
const ALICE = { id: uuid( 1 ), firstName: 'Alice', lastName: 'Walker' };
const ADA = { id: uuid( 2 ), firstName: 'Ada', lastName: 'Admin' };

const report = ( n: number, overrides: Partial<ReportJson> = {} ): ReportJson => ( {
    id: uuid( 500 + n ),
    reason: ReportReason.Other,
    details: 'One of the links is broken.',
    status: ReportStatus.Open,
    resolutionNote: null,
    resolvedAt: null,
    createdAt: new Date( Date.now() - 2 * DAY - 60_000 ).toISOString(),
    learningPath: {
        id: uuid( 300 + n ),
        title: 'Alice\'s Favourite Problems',
        organizationId: uuid( 9 ),
        visibility: PathVisibility.Public,
        publicBlockedAt: null,
        createdBy: ALICE,
    },
    resolvedBy: null,
    reporter: { id: uuid( 3 ), email: 'bob@example.com', firstName: 'Bob', lastName: 'Singh' },
    ...overrides,
} );

const OPEN = report( 1 );
const DISMISSED = report( 2, {
    reason: ReportReason.Spam,
    status: ReportStatus.Dismissed,
    resolutionNote: 'A personal selection, not a copy.',
    resolvedAt: new Date().toISOString(),
    resolvedBy: ADA,
} );
const HIDDEN = report( 3, {
    reason: ReportReason.Copyright,
    status: ReportStatus.Actioned,
    resolvedAt: new Date().toISOString(),
    resolvedBy: null,
    learningPath: { ...OPEN.learningPath, id: uuid( 303 ), title: 'Copied Path', visibility: PathVisibility.Private, publicBlockedAt: new Date().toISOString() },
} );

const page = ( items: ReportJson[] ) => json( 200, { items, total: items.length } );

function api( handlers: Handlers = {} ) {
    return mockApi( {
        ...loggedIn,
        'GET /auth/me': () => json( 200, ADMIN ),
        'GET /admin/reports': () => page( [] ),
        ...handlers,
    } );
}

/** Answers GET /admin/reports by its status filter. */
const byStatus = ( open: () => ReportJson[], resolved: () => ReportJson[] ) => () => {
    const query = vi.mocked( fetch ).mock.calls.at( -1 )?.[0] as string;

    return page( query.includes( 'status=resolved' ) ? resolved() : open() );
};

describe( 'ReportsPage', () => {
    it( 'shows the open reports, with what was reported and by whom, and the recently resolved ones', async () => {
        api( { 'GET /admin/reports': byStatus( () => [ OPEN ], () => [ DISMISSED, HIDDEN ] ) } );
        renderApp( '/app/admin/reports' );

        const card = await screen.findByRole( 'region', { name: 'Report on Alice\'s Favourite Problems' } );

        expect( within( screen.getByRole( 'navigation', { name: 'Admin' } ) ).getByRole( 'link', { name: 'Reports · 1' } ) )
            .toHaveAttribute( 'aria-current', 'page' );
        expect( screen.getByRole( 'heading', { level: 1, name: 'Reports' } ) ).toBeInTheDocument();
        expect( screen.getAllByRole( 'tab' ).map( ( tab ) => tab.textContent ) ).toEqual( [ 'Open · 1', 'Resolved' ] );
        expect( card ).toHaveTextContent( 'Alice\'s Favourite ProblemsCommunityPublic path by Alice WalkerReason: Other' );
        expect( card ).toHaveTextContent( '“One of the links is broken.”Reported by Bob Singh · 2 days ago' );
        expect( within( card ).getByRole( 'link', { name: 'View path' } ) ).toHaveAttribute( 'href', `/app/catalog/${OPEN.learningPath.id}` );

        const recent = within( screen.getByRole( 'region', { name: 'Recently resolved' } ) ).getAllByRole( 'listitem' );

        expect( recent.map( ( row ) => row.textContent ) ).toEqual( [
            'Alice\'s Favourite Problems · SpamDismissed by Ada Admin · “A personal selection, not a copy.”Dismissed',
            'Copied Path · CopyrightPath hidden by a deleted accountUn-hideHidden',
        ] );
    } );

    it( 'dismisses a report or hides the path, with an optional note', async () => {
        let open = [ OPEN, report( 4, { details: null, reporter: null, learningPath: { ...OPEN.learningPath, id: uuid( 304 ), title: 'Spammy', createdBy: null, visibility: PathVisibility.Private } } ) ];
        let answer = () => json( 409, { statusCode: 409, message: 'This report is already resolved' } );
        const { calls } = api( {
            'GET /admin/reports': byStatus( () => open, () => [] ),
            [`PATCH /admin/reports/${OPEN.id}`]: () => answer(),
            [`PATCH /admin/reports/${uuid( 504 )}`]: () => json( 200, {} ),
        } );
        const user = userEvent.setup();

        renderApp( '/app/admin/reports' );
        const first = within( await screen.findByRole( 'region', { name: 'Report on Alice\'s Favourite Problems' } ) );
        const second = within( screen.getByRole( 'region', { name: 'Report on Spammy' } ) );

        expect( screen.getByRole( 'region', { name: 'Report on Spammy' } ) )
            .toHaveTextContent( 'Private path by a deleted account' );
        expect( screen.getByRole( 'region', { name: 'Report on Spammy' } ) )
            .toHaveTextContent( 'No details given.Reported by a deleted account · 2 days ago' );

        await user.type( first.getByLabelText( 'Note (optional)' ), '  Checked: the link works. ' );
        await user.click( first.getByRole( 'button', { name: 'Dismiss' } ) );
        expect( await first.findByRole( 'alert' ) ).toHaveTextContent( 'This report is already resolved. Reload to see the latest.' );

        answer = () => json( 200, {} );
        open = [ open[1] ];
        await user.click( first.getByRole( 'button', { name: 'Dismiss' } ) );
        await waitFor( () => expect( screen.queryByRole( 'region', { name: 'Report on Alice\'s Favourite Problems' } ) ).not.toBeInTheDocument() );
        expect( calls.filter( ( call ) => call.method === 'PATCH' ).at( -1 )?.body ).toEqual( { action: 'dismiss', note: 'Checked: the link works.' } );
        expect( screen.getByRole( 'tab', { name: 'Open · 1' } ) ).toBeInTheDocument();

        open = [];
        await user.click( second.getByRole( 'button', { name: 'Hide path' } ) );
        expect( await screen.findByText( 'Nothing to review. Reports from users show up here.' ) ).toBeInTheDocument();
        expect( calls.filter( ( call ) => call.method === 'PATCH' ).at( -1 )?.body ).toEqual( { action: 'hide_path' } );
    } );

    it( 'waits while acting, and explains other failures', async () => {
        let answer: () => Response | Promise<Response> = pending;

        api( {
            'GET /admin/reports': byStatus( () => [ OPEN ], () => [] ),
            [`PATCH /admin/reports/${OPEN.id}`]: () => answer(),
        } );
        const user = userEvent.setup();

        const first = renderApp( '/app/admin/reports' );
        const card = within( await screen.findByRole( 'region', { name: /^Report on/ } ) );

        await user.click( card.getByRole( 'button', { name: 'Hide path' } ) );
        expect( card.getByRole( 'button', { name: 'Hiding…' } ) ).toBeDisabled();
        expect( card.getByRole( 'button', { name: 'Dismiss' } ) ).toBeDisabled();
        first.unmount();

        answer = () => json( 500, {} );
        renderApp( '/app/admin/reports' );
        const again = within( await screen.findByRole( 'region', { name: /^Report on/ } ) );

        await user.click( again.getByRole( 'button', { name: 'Dismiss' } ) );
        expect( await again.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so nothing changed.' );

        answer = () => Promise.reject( new TypeError( 'Failed to fetch' ) );
        await user.click( again.getByRole( 'button', { name: 'Dismiss' } ) );
        await waitFor( () => expect( again.getByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach Gradiaqo right now.' ) );
    } );

    it( 'lists every resolved report, and un-hides a path hidden by mistake', async () => {
        let resolved = [ HIDDEN, DISMISSED ];
        let answer = () => json( 409, { statusCode: 409, message: 'This path isn\'t hidden' } );
        const { calls } = api( {
            'GET /admin/reports': byStatus( () => [], () => resolved ),
            [`POST /admin/paths/${HIDDEN.learningPath.id}/unhide`]: () => answer(),
        } );
        const user = userEvent.setup();

        renderApp( '/app/admin/reports' );
        await user.click( await screen.findByRole( 'tab', { name: 'Resolved' } ) );

        const list = within( screen.getByRole( 'region', { name: 'Resolved reports' } ) );

        expect( screen.getByRole( 'tab', { name: 'Resolved' } ) ).toHaveAttribute( 'aria-selected', 'true' );
        expect( list.getAllByRole( 'listitem' ) ).toHaveLength( 2 );

        await user.click( list.getByRole( 'button', { name: 'Un-hide Copied Path' } ) );
        expect( await list.findByRole( 'alert' ) ).toHaveTextContent( 'This path isn\'t hidden. Reload to see the latest.' );

        answer = () => noContent();
        resolved = [ { ...HIDDEN, learningPath: { ...HIDDEN.learningPath, publicBlockedAt: null } }, DISMISSED ];
        await user.click( list.getByRole( 'button', { name: 'Un-hide Copied Path' } ) );

        await waitFor( () => expect( list.getAllByRole( 'listitem' )[0] ).toHaveTextContent( 'Path hidden by a deleted accountUn-hidden' ) );
        expect( list.queryByRole( 'button', { name: /^Un-hide/ } ) ).not.toBeInTheDocument();
        expect( calls.some( ( call ) => call.path.endsWith( '/unhide' ) ) ).toBe( true );

        await user.click( screen.getByRole( 'tab', { name: 'Open · 0' } ) );
        expect( screen.getByText( 'Nothing to review. Reports from users show up here.' ) ).toBeInTheDocument();
    } );

    it( 'says when nothing was resolved yet', async () => {
        api();
        renderApp( '/app/admin/reports?tab=resolved' );

        expect( await screen.findByText( 'No reports resolved yet.' ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'region', { name: 'Recently resolved' } ) ).not.toBeInTheDocument();
    } );

    it( 'shows a skeleton while loading, and a way to try again', async () => {
        let answer: () => Response | Promise<Response> = pending;

        api( { 'GET /admin/reports': () => answer() } );
        const loading = renderApp( '/app/admin/reports' );

        expect( await screen.findByText( 'Loading the reports…' ) ).toHaveAttribute( 'role', 'status' );
        expect( screen.getByRole( 'tab', { name: 'Open' } ) ).toBeInTheDocument();
        // Gone before the answers change: on a slow machine its request could otherwise get them too.
        loading.unmount();

        answer = () => Promise.reject( new TypeError( 'Failed to fetch' ) );
        renderApp( '/app/admin/reports' );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach Gradiaqo right now.' );

        answer = () => json( 500, {} );
        await userEvent.setup().click( screen.getByRole( 'button', { name: 'Try again' } ) );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong while loading.' );
    } );

    it( 'doesn\'t exist for anyone but superadmins', async () => {
        const { calls } = mockApi( { ...loggedIn } );

        renderApp( '/app/admin/reports' );

        expect( await screen.findByRole( 'heading', { level: 1, name: 'Page not found' } ) ).toBeInTheDocument();
        expect( calls.some( ( call ) => call.path.startsWith( '/admin' ) ) ).toBe( false );
    } );
} );
