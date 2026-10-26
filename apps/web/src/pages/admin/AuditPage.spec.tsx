import type { AuditEventJson } from '@studylog/schemas';
import { AuditAction } from '@studylog/schemas/enums';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, loggedIn, mockApi, pending, USER } from '../../test/api.ts';
import { uuid } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';

type Handlers = Parameters<typeof mockApi>[0];

const ADMIN = { ...USER, platformRole: 'superadmin' };
const HIDDEN: AuditEventJson = {
    id: uuid( 1 ),
    action: AuditAction.PathHidden,
    actor: { id: uuid( 2 ), name: 'Ada Admin' },
    targetId: uuid( 3 ),
    targetLabel: 'Copied Path',
    note: 'Copied from a paid course.',
    createdAt: new Date().toISOString(),
};
const PROMOTED: AuditEventJson = { ...HIDDEN, id: uuid( 4 ), action: AuditAction.UserPromoted, targetLabel: 'bob@example.com', note: null };

const page = ( items: AuditEventJson[], total = items.length ) => json( 200, { items, total } );

function api( handlers: Handlers = {} ) {
    return mockApi( {
        ...loggedIn,
        'GET /auth/me': () => json( 200, ADMIN ),
        'GET /admin/reports': () => json( 200, { items: [], total: 0 } ),
        'GET /admin/audit': () => page( [ HIDDEN, PROMOTED ] ),
        ...handlers,
    } );
}

const auditCalls = ( calls: { path: string; query: string }[] ) =>
    calls.filter( ( call ) => call.path === '/admin/audit' ).map( ( call ) => call.query );

describe( 'Admin › Audit log', () => {
    it( 'says who did what, when, with the note', async () => {
        api();
        renderApp( '/app/admin/audit' );

        const log = await screen.findByRole( 'region', { name: 'Audit log' } );
        const entries = within( log ).getAllByRole( 'listitem' );

        expect( screen.getByRole( 'heading', { level: 1, name: 'Audit log' } ) ).toBeInTheDocument();
        expect( within( screen.getByRole( 'navigation', { name: 'Admin' } ) ).getByRole( 'link', { name: 'Audit log' } ) )
            .toHaveAttribute( 'aria-current', 'page' );
        expect( entries[0] ).toHaveTextContent( /^Ada Admin hid “Copied Path” from the public catalog“Copied from a paid course\.”Today, / );
        expect( entries[1] ).toHaveTextContent( /^Ada Admin made bob@example\.com a superadminToday, / );
        expect( screen.queryByText( 'Loading the audit log…' ) ).not.toBeInTheDocument();
        expect( screen.queryByRole( 'button', { name: 'Try again' } ) ).not.toBeInTheDocument();
        expect( screen.queryByRole( 'button', { name: 'Older' } ) ).not.toBeInTheDocument();
    } );

    it( 'shows one area at a time, from the newest', async () => {
        const { calls } = api( { 'GET /admin/audit': () => page( [ HIDDEN ], 120 ) } );
        const user = userEvent.setup();

        renderApp( '/app/admin/audit' );
        await user.click( await screen.findByRole( 'button', { name: 'Older' } ) );
        await waitFor( () => expect( auditCalls( calls ).at( -1 ) ).toBe( '?limit=50&offset=50' ) );

        await user.selectOptions( screen.getByRole( 'combobox', { name: 'Area' } ), 'Moderation' );
        await waitFor( () => expect( auditCalls( calls ).at( -1 ) ).toBe( '?area=moderation&limit=50' ) );
        expect( await screen.findByRole( 'button', { name: 'Newer' } ) ).toBeDisabled();

        await user.click( screen.getByRole( 'button', { name: 'Older' } ) );
        await user.click( await screen.findByRole( 'button', { name: 'Older' } ) );
        await waitFor( () => expect( auditCalls( calls ).at( -1 ) ).toBe( '?area=moderation&limit=50&offset=100' ) );
        expect( await screen.findByText( '101–101 of 120' ) ).toBeInTheDocument();
        expect( screen.getByRole( 'button', { name: 'Older' } ) ).toBeDisabled();

        await user.click( screen.getByRole( 'button', { name: 'Newer' } ) );
        await waitFor( () => expect( auditCalls( calls ).at( -1 ) ).toBe( '?area=moderation&limit=50&offset=50' ) );
    } );

    it( 'says when nothing was recorded, while loading, and on a load error', async () => {
        let answer: () => Response | Promise<Response> = () => pending();

        api( { 'GET /admin/audit': () => answer() } );
        const user = userEvent.setup();

        renderApp( '/app/admin/audit' );
        expect( await screen.findByText( 'Loading the audit log…' ) ).toBeInTheDocument();

        answer = () => json( 500, { statusCode: 500, message: 'Boom' } );
        await user.selectOptions( screen.getByRole( 'combobox', { name: 'Area' } ), 'Users' );
        const retry = await screen.findByRole( 'button', { name: 'Try again' } );

        answer = () => page( [] );
        await user.click( retry );
        expect( await screen.findByText( 'Nothing recorded yet.' ) ).toBeInTheDocument();
    } );

    it( 'doesn\'t exist for anyone but superadmins', async () => {
        const { calls } = mockApi( loggedIn );

        renderApp( '/app/admin/audit' );

        expect( await screen.findByRole( 'heading', { level: 1, name: 'Page not found' } ) ).toBeInTheDocument();
        expect( calls.some( ( call ) => call.path.startsWith( '/admin' ) ) ).toBe( false );
    } );
} );
