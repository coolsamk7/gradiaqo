import type { EnrollmentDetailJson } from '@studylog/schemas';
import { EnrollmentStatus, OrderParentType, RuleMode, RuleScope } from '@studylog/schemas/enums';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, loggedIn, mockApi, noContent, pending } from '../../test/api.ts';
import type { TreeSpec } from '../../test/fixtures.ts';
import { enrollment, enrollmentDetail, publishedPath, uuid } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';
import { formatSince } from './settings.ts';

const SPEC: TreeSpec[] = [
    { title: 'Arrays & Hashing', topics: [
        { id: uuid( 1 ), title: 'Hashing Basics', items: [ { id: uuid( 11 ), title: 'Two Sum' } ] },
        { id: uuid( 2 ), title: 'Two Pointers', items: [ { id: uuid( 12 ), title: '3Sum' } ] },
    ] },
    { title: 'Dynamic Programming', topics: [ { id: uuid( 3 ), title: '1-D DP', items: [ { id: uuid( 13 ), title: 'Climbing Stairs' } ] } ] },
];

const BASE = { ...enrollment( 'Data Structures & Algorithms', EnrollmentStatus.Active, 0, 2, uuid( 900 ) ), enrolledAt: '2026-08-21T09:00:00.000Z' };
const PATH = publishedPath( 'Data Structures & Algorithms', SPEC, { id: BASE.learningPath.id } );
const SKIP = { scope: RuleScope.Item, scopeId: uuid( 12 ), mode: RuleMode.Exclude };
/** Follows Arrays & Hashing only, and skips 3Sum. */
const DETAIL: EnrollmentDetailJson = {
    ...enrollmentDetail( BASE, [ SPEC[0] ] ),
    rules: [ { scope: RuleScope.Module, scopeId: uuid( 700 ), mode: RuleMode.Include }, SKIP ],
};
const URL = `/me/enrollments/${DETAIL.id}`;

type Handlers = Parameters<typeof mockApi>[0];

function api( detail: EnrollmentDetailJson = DETAIL, handlers: Handlers = {} ) {
    return mockApi( {
        ...loggedIn,
        [`GET ${URL}`]: () => json( 200, detail ),
        [`GET /catalog/paths/${PATH.id}`]: () => json( 200, PATH ),
        [`PATCH ${URL}`]: () => json( 200, detail ),
        [`PUT ${URL}/rules`]: () => json( 200, detail ),
        [`DELETE ${URL}`]: () => noContent(),
        'GET /me/stats': pending,
        'GET /me/enrollments': pending,
        'GET /me/study-sessions': pending,
        ...handlers,
    } );
}

const card = ( name: string ) => screen.getByRole( 'region', { name } );

describe( 'PathSettingsPage', () => {
    beforeEach( () => {
        vi.useFakeTimers( { toFake: [ 'Date' ] } );
        vi.setSystemTime( new Date( '2026-10-19T09:00:00Z' ) );
    } );

    afterEach( () => {
        vi.useRealTimers();
    } );

    it( 'shows the status, what is followed and the way out', async () => {
        api();
        renderApp( `/app/paths/${DETAIL.id}/settings` );

        expect( await screen.findByRole( 'heading', { level: 1, name: 'Path settings' } ) ).toBeInTheDocument();
        expect( screen.getByText( 'Data Structures & Algorithms · followed since Aug 21' ) ).toBeInTheDocument();
        expect( screen.getByRole( 'link', { name: 'Back to Data Structures & Algorithms' } ) ).toHaveAttribute( 'href', `/app/paths/${DETAIL.id}` );
        expect( card( 'Status' ) ).toHaveTextContent( 'StatusActivePause a path to take a break.' );
        expect( within( card( 'Status' ) ).getByRole( 'button', { name: 'Pause' } ) ).toBeInTheDocument();
        expect( card( 'What you follow' ) ).toHaveTextContent( '1 of 2 modules · 2 of 3 items. Dynamic Programming is left out.' );
        expect( within( card( 'Leave this path' ) ).getByRole( 'button', { name: 'Leave path' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'link', { name: 'Dashboard' } ) ).toHaveAttribute( 'aria-current', 'page' );
    } );

    it( 'pauses and resumes, then shows the new status', async () => {
        let detail = DETAIL;
        const { calls } = api( DETAIL, {
            [`GET ${URL}`]: () => json( 200, detail ),
            [`PATCH ${URL}`]: ( init ) => {
                const { status } = JSON.parse( init.body as string ) as { status: EnrollmentStatus };

                detail = { ...detail, status };

                return json( 200, detail );
            },
        } );
        const user = userEvent.setup();

        renderApp( `/app/paths/${DETAIL.id}/settings` );
        await user.click( await screen.findByRole( 'button', { name: 'Pause' } ) );
        expect( await within( card( 'Status' ) ).findByText( 'Paused' ) ).toBeInTheDocument();
        expect( card( 'Status' ) ).toHaveTextContent( 'You\'re taking a break from this path.' );

        await user.click( screen.getByRole( 'button', { name: 'Resume' } ) );
        expect( await within( card( 'Status' ) ).findByText( 'Active' ) ).toBeInTheDocument();
        expect( calls.filter( ( call ) => call.method === 'PATCH' ).map( ( call ) => call.body ) )
            .toEqual( [ { status: 'paused' }, { status: 'active' } ] );
    } );

    it( 'offers following a dropped path again, and nothing for a completed one', async () => {
        api( { ...DETAIL, status: EnrollmentStatus.Dropped } );
        const dropped = renderApp( `/app/paths/${DETAIL.id}/settings` );

        expect( await screen.findByRole( 'button', { name: 'Follow again' } ) ).toBeInTheDocument();
        expect( card( 'Status' ) ).toHaveTextContent( 'Dropped' );
        dropped.unmount();

        api( { ...DETAIL, status: EnrollmentStatus.Completed } );
        renderApp( `/app/paths/${DETAIL.id}/settings` );

        expect( await within( await screen.findByRole( 'region', { name: 'Status' } ) ).findByText( 'Completed' ) ).toBeInTheDocument();
        expect( within( card( 'Status' ) ).queryByRole( 'button' ) ).not.toBeInTheDocument();
    } );

    it( 'says when the status couldn\'t be changed', async () => {
        api( DETAIL, { [`PATCH ${URL}`]: () => json( 500, {} ) } );
        renderApp( `/app/paths/${DETAIL.id}/settings` );
        await userEvent.setup().click( await screen.findByRole( 'button', { name: 'Pause' } ) );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so the status wasn\'t changed.' );
        expect( screen.getByRole( 'button', { name: 'Pause' } ) ).toBeEnabled();
    } );

    it( 'changes which parts are followed, keeping skipped items', async () => {
        const { calls } = api();
        const user = userEvent.setup();

        renderApp( `/app/paths/${DETAIL.id}/settings` );
        await user.click( await screen.findByRole( 'button', { name: 'Edit parts' } ) );

        const dialog = screen.getByRole( 'dialog', { name: 'Choose what to follow' } );

        expect( within( dialog ).getByRole( 'checkbox', { name: /^Arrays & Hashing/ } ) ).toBeChecked();
        expect( within( dialog ).getByRole( 'checkbox', { name: /^Dynamic Programming/ } ) ).not.toBeChecked();
        await user.click( within( dialog ).getByRole( 'checkbox', { name: /^Dynamic Programming/ } ) );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Save' } ) );

        await waitFor( () => expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument() );
        expect( calls.find( ( call ) => call.method === 'PUT' )?.body ).toEqual( { rules: [ SKIP ] } );
        expect( calls.filter( ( call ) => call.path === URL && call.method === 'GET' ) ).toHaveLength( 2 );
    } );

    it( 'keeps the page when the new parts can\'t be loaded, and closes the dialog without saving', async () => {
        let loads = 0;
        const { calls } = api( DETAIL, {
            [`GET ${URL}`]: () => {
                loads += 1;

                return loads === 1 ? json( 200, DETAIL ) : json( 500, {} );
            },
        } );
        const user = userEvent.setup();

        renderApp( `/app/paths/${DETAIL.id}/settings` );
        await user.click( await screen.findByRole( 'button', { name: 'Edit parts' } ) );
        await user.click( screen.getByRole( 'button', { name: 'Cancel' } ) );
        expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
        expect( calls.some( ( call ) => call.method === 'PUT' ) ).toBe( false );

        await user.click( screen.getByRole( 'button', { name: 'Edit parts' } ) );
        await user.click( screen.getByRole( 'button', { name: 'Save' } ) );
        await waitFor( () => expect( loads ).toBe( 2 ) );
        expect( screen.getByRole( 'heading', { level: 1, name: 'Path settings' } ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();
    } );

    it( 'says when the parts couldn\'t be changed', async () => {
        api( DETAIL, { [`PUT ${URL}/rules`]: () => Promise.reject( new TypeError( 'Failed to fetch' ) ) } );
        const user = userEvent.setup();

        renderApp( `/app/paths/${DETAIL.id}/settings` );
        await user.click( await screen.findByRole( 'button', { name: 'Edit parts' } ) );
        await user.click( screen.getByRole( 'button', { name: 'Save' } ) );

        expect( await within( screen.getByRole( 'dialog' ) ).findByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach StudyLog right now.' );
    } );

    it( 'can\'t change parts of a path that was unpublished', async () => {
        api( DETAIL, { [`GET /catalog/paths/${PATH.id}`]: () => json( 404, {} ) } );
        renderApp( `/app/paths/${DETAIL.id}/settings` );

        expect( await screen.findByText( /isn't published any more/ ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'button', { name: 'Edit parts' } ) ).not.toBeInTheDocument();
    } );

    it( 'orders modules and the topics in them', async () => {
        const all = enrollmentDetail( BASE, SPEC );
        const { calls } = api( all );
        const user = userEvent.setup();

        renderApp( `/app/paths/${DETAIL.id}/settings` );
        const order = await screen.findByRole( 'region', { name: 'Your order' } );
        const modules = within( order ).getByRole( 'list', { name: 'Modules' } );

        expect( within( modules ).getAllByRole( 'listitem' ).map( ( row ) => row.textContent ) )
            .toEqual( [ 'Arrays & HashingHashing Basics, Two Pointers', 'Dynamic Programming1-D DP' ] );
        expect( within( order ).queryByRole( 'button', { name: 'Reset to the author\'s order' } ) ).not.toBeInTheDocument();
        expect( within( order ).getByRole( 'button', { name: 'Move Arrays & Hashing up' } ) ).toBeDisabled();
        expect( within( order ).getByRole( 'button', { name: 'Move Dynamic Programming down' } ) ).toBeDisabled();
        // One topic: nothing to order inside.
        expect( within( order ).queryByRole( 'button', { name: 'Order the topics in Dynamic Programming' } ) ).not.toBeInTheDocument();

        await user.click( within( order ).getByRole( 'button', { name: 'Move Dynamic Programming up' } ) );
        await waitFor( () => expect( calls.filter( ( call ) => call.method === 'PUT' ) ).toHaveLength( 1 ) );
        expect( calls.find( ( call ) => call.method === 'PUT' ) ).toMatchObject( {
            path: `${URL}/orders/path/${PATH.id}`,
            body: { ids: [ uuid( 701 ), uuid( 700 ) ] },
        } );

        const expand = within( order ).getByRole( 'button', { name: 'Order the topics in Arrays & Hashing' } );

        expect( expand ).toHaveAttribute( 'aria-expanded', 'false' );
        await user.click( expand );
        const topics = within( order ).getByRole( 'list', { name: 'Topics in Arrays & Hashing' } );

        await user.click( within( topics ).getByRole( 'button', { name: 'Move Two Pointers up' } ) );
        await waitFor( () => expect( calls.filter( ( call ) => call.method === 'PUT' ) ).toHaveLength( 2 ) );
        expect( calls.filter( ( call ) => call.method === 'PUT' ).at( -1 ) ).toMatchObject( {
            path: `${URL}/orders/module/${uuid( 700 )}`,
            body: { ids: [ uuid( 2 ), uuid( 1 ) ] },
        } );

        await user.click( within( order ).getByRole( 'button', { name: 'Hide the topics in Arrays & Hashing' } ) );
        expect( within( order ).queryByRole( 'list', { name: 'Topics in Arrays & Hashing' } ) ).not.toBeInTheDocument();
    } );

    it( 'resets every order the user set', async () => {
        const ordered: EnrollmentDetailJson = {
            ...enrollmentDetail( BASE, SPEC ),
            orders: [
                { parentType: OrderParentType.Path, parentId: PATH.id, orderedIds: [ uuid( 701 ), uuid( 700 ) ] },
                { parentType: OrderParentType.Topic, parentId: uuid( 1 ), orderedIds: [ uuid( 11 ) ] },
            ],
        };
        const { calls } = api( ordered, {
            [`DELETE ${URL}/orders/path/${PATH.id}`]: () => json( 200, ordered ),
            [`DELETE ${URL}/orders/topic/${uuid( 1 )}`]: () => json( 200, ordered ),
        } );

        renderApp( `/app/paths/${DETAIL.id}/settings` );
        await userEvent.setup().click( await screen.findByRole( 'button', { name: 'Reset to the author\'s order' } ) );

        await waitFor( () => expect( calls.filter( ( call ) => call.method === 'DELETE' ) ).toHaveLength( 2 ) );
        expect( calls.filter( ( call ) => call.method === 'DELETE' ).map( ( call ) => call.path ) )
            .toEqual( [ `${URL}/orders/path/${PATH.id}`, `${URL}/orders/topic/${uuid( 1 )}` ] );
    } );

    it( 'says when the order couldn\'t be changed', async () => {
        api( enrollmentDetail( BASE, SPEC ), { [`PUT ${URL}/orders/path/${PATH.id}`]: () => json( 400, {} ) } );
        renderApp( `/app/paths/${DETAIL.id}/settings` );
        await userEvent.setup().click( await screen.findByRole( 'button', { name: 'Move Arrays & Hashing down' } ) );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so the order wasn\'t changed.' );
        expect( screen.getByRole( 'button', { name: 'Move Arrays & Hashing down' } ) ).toBeEnabled();
    } );

    it( 'has nothing to order in an empty path', async () => {
        api( enrollmentDetail( BASE, [ { title: 'Empty', topics: [] } ] ) );
        const first = renderApp( `/app/paths/${DETAIL.id}/settings` );

        expect( await screen.findByText( 'No topics' ) ).toBeInTheDocument();
        first.unmount();

        api( enrollmentDetail( BASE, [] ) );
        renderApp( `/app/paths/${DETAIL.id}/settings` );

        expect( await screen.findByText( 'Nothing to order yet.' ) ).toBeInTheDocument();
    } );

    it( 'leaves the path after asking, then goes to the dashboard', async () => {
        const { calls } = api();
        const user = userEvent.setup();

        renderApp( `/app/paths/${DETAIL.id}/settings` );
        await user.click( await screen.findByRole( 'button', { name: 'Leave path' } ) );

        const dialog = screen.getByRole( 'dialog', { name: 'Leave Data Structures & Algorithms?' } );

        expect( dialog ).toHaveTextContent( 'Your progress and study sessions are kept' );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Cancel' } ) );
        expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();

        await user.click( screen.getByRole( 'button', { name: 'Leave path' } ) );
        await user.click( within( screen.getByRole( 'dialog' ) ).getByRole( 'button', { name: 'Leave path' } ) );

        await waitFor( () => expect( screen.getByTestId( 'location' ) ).toHaveTextContent( /^\/app$/ ) );
        expect( calls.some( ( call ) => call.method === 'DELETE' && call.path === URL ) ).toBe( true );
    } );

    it( 'says when leaving failed', async () => {
        let answer = () => json( 500, {} );

        api( DETAIL, { [`DELETE ${URL}`]: () => answer() } );
        const user = userEvent.setup();

        renderApp( `/app/paths/${DETAIL.id}/settings` );
        await user.click( await screen.findByRole( 'button', { name: 'Leave path' } ) );
        const dialog = screen.getByRole( 'dialog' );

        await user.click( within( dialog ).getByRole( 'button', { name: 'Leave path' } ) );
        expect( await within( dialog ).findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so you didn\'t leave the path.' );

        answer = () => new Promise<Response>( () => undefined ) as unknown as Response;
        await user.click( within( dialog ).getByRole( 'button', { name: 'Leave path' } ) );
        expect( await within( dialog ).findByRole( 'button', { name: 'Leaving…' } ) ).toBeDisabled();
    } );

    it( 'says when the path isn\'t on the list', async () => {
        api( DETAIL, { [`GET ${URL}`]: () => json( 404, {} ) } );
        renderApp( `/app/paths/${DETAIL.id}/settings` );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'This learning path isn\'t on your list.' );
        expect( screen.getByRole( 'link', { name: 'Back to Learning path' } ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'button', { name: 'Try again' } ) ).not.toBeInTheDocument();
    } );

    it( 'says when loading failed, and tries again', async () => {
        let fail = true;

        api( DETAIL, {
            [`GET ${URL}`]: () => {
                const failed = fail;

                fail = false;

                return failed ? Promise.reject( new TypeError( 'Failed to fetch' ) ) : json( 200, DETAIL );
            },
        } );
        renderApp( `/app/paths/${DETAIL.id}/settings` );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach StudyLog right now.' );
        await userEvent.setup().click( screen.getByRole( 'button', { name: 'Try again' } ) );
        expect( await screen.findByRole( 'heading', { level: 1, name: 'Path settings' } ) ).toBeInTheDocument();
    } );

    it( 'says other loading errors, while loading first', async () => {
        mockApi( { ...loggedIn, [`GET ${URL}`]: pending } );
        const loading = renderApp( `/app/paths/${DETAIL.id}/settings` );

        expect( await screen.findByText( 'Loading the settings…' ) ).toBeInTheDocument();
        loading.unmount();

        api( DETAIL, { [`GET ${URL}`]: () => json( 500, {} ) } );
        renderApp( `/app/paths/${DETAIL.id}/settings` );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong while loading the settings.' );
    } );

    it( 'writes when the path was followed from', () => {
        const now = new Date( '2026-10-19T09:00:00Z' );

        expect( formatSince( '2026-08-21T09:00:00.000Z', now ) ).toBe( 'Aug 21' );
        expect( formatSince( '2025-08-21T09:00:00.000Z', now ) ).toBe( 'Aug 21, 2025' );
    } );
} );
