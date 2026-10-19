import type { StudySessionPageJson } from '@studylog/schemas';
import { EnrollmentStatus, ItemType } from '@studylog/schemas/enums';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { RecordedCall } from '../../test/api.ts';
import { json, loggedIn, mockApi, noContent, pending } from '../../test/api.ts';
import { enrollment, enrollmentDetail, session, uuid } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';

// Tests run in UTC (see vitest.config.ts). "Now" is Tuesday Sep 29, 2026, 9:00 AM.
const NOW = new Date( '2026-09-29T09:00:00Z' );

const HASHING = { id: uuid( 1 ), title: 'Hashing Basics' };
const TWO_SUM = { id: uuid( 11 ), title: 'Two Sum', type: ItemType.Problem };

const HISTORY: StudySessionPageJson = {
    total: 4,
    items: [
        session( uuid( 101 ), '2026-09-29T08:00:00.000Z', 45, { topic: HASHING, item: TWO_SUM, notes: 'Finally clicked!' } ),
        session( uuid( 102 ), '2026-09-29T07:00:00.000Z', 30, { topic: HASHING } ),
        session( uuid( 103 ), '2026-09-28T17:30:00.000Z', 60, { item: TWO_SUM } ),
        session( uuid( 104 ), '2026-09-22T10:00:00.000Z', 20 ),
    ],
};

const DSA = enrollment( 'Data Structures & Algorithms', EnrollmentStatus.Active, 13, 19, uuid( 201 ) );
const SYSTEM_DESIGN = enrollment( 'System Design Fundamentals', EnrollmentStatus.Paused, 1, 6, uuid( 202 ) );
const DROPPED = enrollment( 'Given Up', EnrollmentStatus.Dropped, 0, 3, uuid( 203 ) );

const DSA_TREE = enrollmentDetail( DSA, [
    {
        title: 'Arrays & Hashing',
        topics: [
            { ...HASHING, items: [ { id: TWO_SUM.id, title: 'Two Sum' }, { id: uuid( 12 ), title: 'Hash Tables Explained', optional: true } ] },
            { id: uuid( 2 ), title: 'Two Pointers', items: [ { id: uuid( 21 ), title: '3Sum' } ] },
        ],
    },
    { title: 'Trees', topics: [ { id: uuid( 3 ), title: 'Tree Traversals', items: [] } ] },
] );
const SYSTEM_DESIGN_TREE = enrollmentDetail( SYSTEM_DESIGN, [
    { title: 'Foundations', topics: [ { id: uuid( 4 ), title: 'Caching', items: [] } ] },
] );

type Handlers = Parameters<typeof mockApi>[0];

/** A logged-in user with this history, these learning paths and trees, and a working API for changes. */
function api( handlers: Handlers = {} ) {
    return mockApi( {
        ...loggedIn,
        'GET /me/study-sessions': () => json( 200, HISTORY ),
        'GET /me/enrollments': () => json( 200, [ DSA, SYSTEM_DESIGN, DROPPED ] ),
        [`GET /me/enrollments/${DSA.id}`]: () => json( 200, DSA_TREE ),
        [`GET /me/enrollments/${SYSTEM_DESIGN.id}`]: () => json( 200, SYSTEM_DESIGN_TREE ),
        'POST /me/study-sessions': () => json( 201, HISTORY.items[0] ),
        [`PATCH /me/study-sessions/${uuid( 101 )}`]: () => json( 200, HISTORY.items[0] ),
        [`DELETE /me/study-sessions/${uuid( 101 )}`]: () => noContent(),
        ...handlers,
    } );
}

const calledWith = ( calls: RecordedCall[], method: string, path: string ) =>
    calls.filter( ( call ) => call.method === method && call.path === path );

/** The history section for a day, by its heading ("Today", "Yesterday", "Tue, Sep 22"). */
const day = ( heading: string ) => screen.getByRole( 'region', { name: heading } );

/** The history row for a session, by its title. */
/** A button in the "Delete this session?" question of the "Two Sum" row. */
const confirmButton = ( name: string ) =>
    within( within( row( 'Two Sum' ) ).getByRole( 'group', { name: 'Delete this session?' } ) ).getByRole( 'button', { name } );

const row = ( title: string, heading = 'Today' ) =>
    within( day( heading ) ).getAllByRole( 'listitem' ).find( ( item ) => item.querySelector( 'p' )?.textContent === title )!;

describe( 'SessionsPage', () => {
    beforeEach( () => {
        vi.useFakeTimers( { toFake: [ 'Date' ] } );
        vi.setSystemTime( NOW );
    } );

    afterEach( () => {
        vi.useRealTimers();
    } );

    describe( 'history', () => {
        it( 'groups sessions by day, newest first, with each day\'s total', async () => {
            const { calls } = api();

            renderApp( '/app/sessions' );

            expect( await screen.findByRole( 'region', { name: 'Today' } ) ).toHaveTextContent( '1h 15m studied' );
            expect( screen.getByRole( 'heading', { level: 1 } ) ).toHaveTextContent( 'Study sessions' );
            expect( screen.getByText( '4 sessions logged' ) ).toBeInTheDocument();
            expect( screen.getAllByRole( 'heading', { level: 2 } ).map( ( heading ) => heading.textContent ) )
                .toEqual( [ 'Today', 'Yesterday', 'Tue, Sep 22' ] );
            expect( row( 'Two Sum' ) ).toHaveTextContent( 'Two SumHashing Basics · 8:00 AMFinally clicked!EditDelete45m' );
            expect( row( 'Hashing Basics' ) ).toHaveTextContent( 'Hashing Basics7:00 AMEditDelete30m' );
            expect( row( 'Two Sum', 'Yesterday' ) ).toHaveTextContent( 'Two Sum5:30 PMEditDelete1h' );
            expect( row( 'Study session', 'Tue, Sep 22' ) ).toHaveTextContent( '10:00 AM' );
            expect( calledWith( calls, 'GET', '/me/study-sessions' )[0]?.query ).toBe( '?limit=20&offset=0' );
            // The page is current in the navigation; nothing else loads until the form opens.
            expect( screen.getByRole( 'link', { name: 'Sessions' } ) ).toHaveAttribute( 'aria-current', 'page' );
            expect( screen.getByRole( 'link', { name: 'Sessions' } ) ).toHaveAttribute( 'href', '/app/sessions' );
            expect( screen.getByRole( 'link', { name: 'Dashboard' } ) ).toHaveAttribute( 'href', '/app' );
            expect( screen.queryByText( 'Loading your sessions…' ) ).not.toBeInTheDocument();
            expect( screen.queryByText( /No study sessions yet/ ) ).not.toBeInTheDocument();
            expect( row( 'Hashing Basics' ).querySelectorAll( 'p' ) ).toHaveLength( 2 );
            expect( screen.queryByRole( 'button', { name: /Show more/ } ) ).not.toBeInTheDocument(); // all 4 are shown
            expect( screen.getByRole( 'link', { name: 'Dashboard' } ) ).not.toHaveAttribute( 'aria-current' );
            expect( calledWith( calls, 'GET', '/me/enrollments' ) ).toHaveLength( 0 );
        } );

        it( 'says "1 session" for one', async () => {
            api( { 'GET /me/study-sessions': () => json( 200, { total: 1, items: [ HISTORY.items[3] ] } ) } );
            renderApp( '/app/sessions' );

            expect( await screen.findByText( '1 session logged' ) ).toBeInTheDocument();
        } );

        it( 'loads older sessions a page at a time, and retries a page that failed', async () => {
            const first = Array.from( { length: 20 }, ( _, i ) => session( uuid( 300 + i ), '2026-09-29T08:00:00.000Z', 10 ) );
            const second = [ session( uuid( 400 ), '2026-09-20T08:00:00.000Z', 10 ) ];
            // The fake API can't see the query string: answer by how many pages were asked for.
            const answers = [
                () => json( 200, { total: 22, items: first } ),
                () => json( 500, { message: 'Oops' } ),
                () => json( 200, { total: 22, items: second } ),
            ];

            api( { 'GET /me/study-sessions': () => ( answers.shift() as () => Response )() } );
            renderApp( '/app/sessions' );

            const user = userEvent.setup();

            await user.click( await screen.findByRole( 'button', { name: 'Show more (2 left)' } ) );
            expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong while loading your sessions.' );
            expect( within( day( 'Today' ) ).getAllByRole( 'listitem' ) ).toHaveLength( 20 );

            await user.click( screen.getByRole( 'button', { name: 'Show more (2 left)' } ) );
            expect( await screen.findByRole( 'region', { name: 'Sun, Sep 20' } ) ).toBeInTheDocument();
            expect( screen.getByRole( 'button', { name: 'Show more (1 left)' } ) ).toBeEnabled();
            expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();
        } );

        it( 'shows that the next page is loading', async () => {
            let pages = 0;
            const first = Array.from( { length: 20 }, ( _, i ) => session( uuid( 300 + i ), '2026-09-29T08:00:00.000Z', 10 ) );

            api( {
                'GET /me/study-sessions': () => {
                    pages += 1;

                    return pages === 1 ? json( 200, { total: 25, items: first } ) : pending();
                },
            } );
            renderApp( '/app/sessions' );
            await userEvent.setup().click( await screen.findByRole( 'button', { name: 'Show more (5 left)' } ) );

            expect( screen.getByRole( 'button', { name: 'Loading…' } ) ).toBeDisabled();
        } );

        it( 'asks for the next page after what is shown', async () => {
            let pages = 0;
            const first = Array.from( { length: 20 }, ( _, i ) => session( uuid( 300 + i ), '2026-09-29T08:00:00.000Z', 10 ) );
            const { calls } = api( {
                'GET /me/study-sessions': () => {
                    pages += 1;

                    return json( 200, pages === 1 ? { total: 21, items: first } : { total: 21, items: [] } );
                },
            } );

            renderApp( '/app/sessions' );
            await userEvent.setup().click( await screen.findByRole( 'button', { name: 'Show more (1 left)' } ) );

            await waitFor( () => expect( calledWith( calls, 'GET', '/me/study-sessions' ) ).toHaveLength( 2 ) );
            expect( calledWith( calls, 'GET', '/me/study-sessions' )[1]?.query ).toBe( '?limit=20&offset=20' );
        } );

        it( 'invites a new user to log their first session', async () => {
            api( { 'GET /me/study-sessions': () => json( 200, { total: 0, items: [] } ) } );
            renderApp( '/app/sessions' );

            expect( await screen.findByText( 'No study sessions yet. Log your first one to start your streak.' ) ).toBeInTheDocument();
            expect( screen.getByText( 'Log the time you spend studying.' ) ).toBeInTheDocument();
        } );

        it( 'shows a loading state', async () => {
            api( { 'GET /me/study-sessions': pending } );
            renderApp( '/app/sessions' );

            expect( await screen.findByText( 'Loading your sessions…' ) ).toBeInTheDocument();
            expect( screen.getByText( 'Log the time you spend studying.' ) ).toBeInTheDocument();
        } );

        it( 'says when the API can\'t be reached, and loads again on retry', async () => {
            let answer!: ( response: Response ) => void;
            const answers = [
                () => Promise.reject( new TypeError( 'Failed to fetch' ) ),
                () => new Promise<Response>( ( resolve ) => {
                    answer = resolve;
                } ),
            ];

            api( { 'GET /me/study-sessions': () => ( answers.shift() as () => Promise<Response> )() } );
            renderApp( '/app/sessions' );

            expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach StudyLog right now.' );
            await userEvent.setup().click( screen.getByRole( 'button', { name: 'Try again' } ) );
            expect( screen.getByText( 'Loading your sessions…' ) ).toBeInTheDocument();
            expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();

            await waitFor( () => expect( answer ).toBeDefined() );
            answer( json( 200, HISTORY ) );
            expect( await screen.findByRole( 'region', { name: 'Today' } ) ).toBeInTheDocument();
            expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();
        } );
    } );

    describe( 'logging a session', () => {
        it( 'logs time on an item, then shows it in the history', async () => {
            const { calls } = api();
            const user = userEvent.setup();

            renderApp( '/app/sessions' );
            await user.click( await screen.findByRole( 'button', { name: 'Log session' } ) );

            const form = screen.getByRole( 'form', { name: 'Log a study session' } );
            const path = await within( form ).findByLabelText( 'Learning path' );

            // Paths the user follows, not dropped ones. Topics and items wait for a choice.
            expect( within( path ).getAllByRole( 'option' ).map( ( option ) => option.textContent ) )
                .toEqual( [ 'Choose a path', 'Data Structures & Algorithms', 'System Design Fundamentals' ] );
            expect( within( form ).getByLabelText( 'Topic' ) ).toBeDisabled();
            expect( within( form ).getByLabelText( 'Item (optional)' ) ).toBeDisabled();
            // A 30-minute session that just ended.
            expect( within( form ).getByLabelText( 'Date' ) ).toHaveValue( '2026-09-29' );
            expect( within( form ).getByLabelText( 'Start time' ) ).toHaveValue( '08:30' );
            expect( within( form ).getByLabelText( 'Minutes' ) ).toHaveValue( 30 );
            expect( within( form ).getByLabelText( 'Date' ) ).toHaveAttribute( 'max', '2026-09-29' );
            expect( within( form ).queryByText( /Couldn't load this path/ ) ).not.toBeInTheDocument();
            expect( calls.filter( ( call ) => call.path.startsWith( '/me/enrollments/' ) ) ).toHaveLength( 0 );

            await user.selectOptions( path, DSA.id );
            const topic = within( form ).getByLabelText( 'Topic' );

            await waitFor( () => expect( topic ).toBeEnabled() );
            expect( within( topic ).getAllByRole( 'group' ).map( ( group ) => group.getAttribute( 'label' ) ) )
                .toEqual( [ 'Arrays & Hashing', 'Trees' ] );
            expect( within( topic ).getAllByRole( 'option' ).map( ( option ) => option.textContent ) )
                .toEqual( [ 'Choose a topic', 'Hashing Basics', 'Two Pointers', 'Tree Traversals' ] );

            await user.selectOptions( topic, HASHING.id );
            const item = within( form ).getByLabelText( 'Item (optional)' );

            expect( item ).toBeEnabled();
            expect( within( item ).getAllByRole( 'option' ).map( ( option ) => option.textContent ) )
                .toEqual( [ 'Whole topic', 'Two Sum', 'Hash Tables Explained (optional)' ] );

            await user.selectOptions( item, TWO_SUM.id );
            await user.clear( within( form ).getByLabelText( 'Minutes' ) );
            await user.type( within( form ).getByLabelText( 'Minutes' ), '45' );
            await user.type( within( form ).getByLabelText( 'Notes (optional)' ), 'Finally clicked!' );
            await user.click( within( form ).getByRole( 'button', { name: 'Log session' } ) );

            expect( await screen.findByText( 'Session logged.' ) ).toHaveAttribute( 'role', 'status' );
            expect( screen.queryByRole( 'form' ) ).not.toBeInTheDocument();
            expect( calledWith( calls, 'POST', '/me/study-sessions' )[0]?.body ).toEqual( {
                topicId: HASHING.id,
                itemId: TWO_SUM.id,
                startedAt: '2026-09-29T08:30:00.000Z',
                durationMinutes: 45,
                notes: 'Finally clicked!',
            } );
            // The list is loaded again, so the new session shows.
            await waitFor( () => expect( calledWith( calls, 'GET', '/me/study-sessions' ) ).toHaveLength( 2 ) );

            // Opening the form again hides the message.
            await user.click( screen.getByRole( 'button', { name: 'Log session' } ) );
            expect( screen.getByRole( 'status' ) ).toBeEmptyDOMElement();
        } );

        it( 'keeps the list on screen while it reloads after a change', async () => {
            const answers = [ () => json( 200, HISTORY ), pending ];

            api( { 'GET /me/study-sessions': () => ( answers.shift() as () => Response | Promise<Response> )() } );
            const user = userEvent.setup();

            renderApp( '/app/sessions' );
            await screen.findByRole( 'region', { name: 'Today' } );
            await user.click( within( row( 'Two Sum' ) ).getByRole( 'button', { name: 'Delete' } ) );
            await user.click( confirmButton( 'Delete' ) );

            expect( await screen.findByText( 'Session deleted.' ) ).toBeInTheDocument();
            expect( screen.getByRole( 'region', { name: 'Today' } ) ).toBeInTheDocument();
            expect( screen.queryByText( 'Loading your sessions…' ) ).not.toBeInTheDocument();
        } );

        it( 'logs time on a whole topic, and starts the choice over when the path or topic changes', async () => {
            const { calls } = api();
            const user = userEvent.setup();

            renderApp( '/app/sessions?log' );

            const form = await screen.findByRole( 'form', { name: 'Log a study session' } );
            const path = await within( form ).findByLabelText( 'Learning path' );
            const topic = within( form ).getByLabelText( 'Topic' );
            const item = within( form ).getByLabelText( 'Item (optional)' );

            await user.selectOptions( path, DSA.id );
            await waitFor( () => expect( topic ).toBeEnabled() );
            await user.selectOptions( topic, HASHING.id );
            await user.selectOptions( item, TWO_SUM.id );

            await user.selectOptions( topic, uuid( 2 ) );
            expect( item ).toHaveValue( '' );
            expect( within( item ).getAllByRole( 'option' ).map( ( option ) => option.textContent ) ).toEqual( [ 'Whole topic', '3Sum' ] );

            await user.selectOptions( path, SYSTEM_DESIGN.id );
            expect( topic ).toHaveValue( '' );
            await waitFor( () => expect( within( topic ).getByRole( 'option', { name: 'Caching' } ) ).toBeInTheDocument() );
            // A topic of the new path is needed.
            await user.click( within( form ).getByRole( 'button', { name: 'Log session' } ) );
            expect( within( form ).getByText( 'Choose a topic.' ) ).toBeInTheDocument();
            await user.selectOptions( topic, uuid( 4 ) );
            await user.click( within( form ).getByRole( 'button', { name: 'Log session' } ) );

            await screen.findByText( 'Session logged.' );
            expect( calledWith( calls, 'POST', '/me/study-sessions' )[0]?.body ).toEqual( {
                topicId: uuid( 4 ), startedAt: '2026-09-29T08:30:00.000Z', durationMinutes: 30, notes: null,
            } );
        } );

        it( 'checks the form before sending it, and focuses the first problem', async () => {
            const { calls } = api();
            const user = userEvent.setup();

            renderApp( '/app/sessions?log' );

            const form = await screen.findByRole( 'form', { name: 'Log a study session' } );

            await within( form ).findByLabelText( 'Learning path' );
            await user.clear( within( form ).getByLabelText( 'Minutes' ) );
            await user.click( within( form ).getByRole( 'button', { name: 'Log session' } ) );

            expect( within( form ).getByText( 'Choose a learning path.' ) ).toBeInTheDocument();
            expect( within( form ).getByText( 'Enter the minutes you studied, from 1 to 1440.' ) ).toBeInTheDocument();
            expect( within( form ).getByLabelText( 'Learning path' ) ).toHaveFocus();
            expect( within( form ).getByLabelText( 'Learning path' ) ).toHaveAttribute( 'aria-invalid', 'true' );

            await user.selectOptions( within( form ).getByLabelText( 'Learning path' ), DSA.id );
            fireEvent.change( within( form ).getByLabelText( 'Start time' ), { target: { value: '09:30' } } );
            await user.click( within( form ).getByRole( 'button', { name: 'Log session' } ) );
            expect( within( form ).getByText( 'Choose a topic.' ) ).toBeInTheDocument();
            expect( within( form ).getByText( 'The start can\'t be in the future.' ) ).toBeInTheDocument();
            expect( calledWith( calls, 'POST', '/me/study-sessions' ) ).toHaveLength( 0 );
        } );

        it( 'shows the API\'s errors, and lets the user try again', async () => {
            let answer = () => json( 404, { message: 'Topic not found' } );

            api( { 'POST /me/study-sessions': () => answer() } );
            const user = userEvent.setup();

            renderApp( '/app/sessions?log' );

            const form = await screen.findByRole( 'form', { name: 'Log a study session' } );

            await user.selectOptions( await within( form ).findByLabelText( 'Learning path' ), DSA.id );
            await waitFor( () => expect( within( form ).getByLabelText( 'Topic' ) ).toBeEnabled() );
            await user.selectOptions( within( form ).getByLabelText( 'Topic' ), HASHING.id );
            await user.click( within( form ).getByRole( 'button', { name: 'Log session' } ) );

            expect( await within( form ).findByRole( 'alert' ) )
                .toHaveTextContent( 'That topic or item is no longer available. Choose another one.' );
            expect( within( form ).getByRole( 'button', { name: 'Log session' } ) ).toBeEnabled();

            answer = () => json( 400, { message: 'Bad Request', errors: [ { path: '/durationMinutes', message: 'must be at most 1440' } ] } );
            await user.click( within( form ).getByRole( 'button', { name: 'Log session' } ) );
            expect( await within( form ).findByText( 'Duration must be at most 1440.' ) ).toBeInTheDocument();
            expect( within( form ).getByLabelText( 'Minutes' ) ).toHaveFocus();
        } );

        it( 'disables the button while saving', async () => {
            api( { 'POST /me/study-sessions': pending } );
            const user = userEvent.setup();

            renderApp( '/app/sessions?log' );

            const form = await screen.findByRole( 'form', { name: 'Log a study session' } );

            await user.selectOptions( await within( form ).findByLabelText( 'Learning path' ), DSA.id );
            await user.click( within( form ).getByRole( 'button', { name: 'Log session' } ) );
            expect( within( form ).getByText( 'Choose a topic.' ) ).toBeInTheDocument();

            await waitFor( () => expect( within( form ).getByLabelText( 'Topic' ) ).toBeEnabled() );
            await user.selectOptions( within( form ).getByLabelText( 'Topic' ), HASHING.id );
            await user.click( within( form ).getByRole( 'button', { name: 'Log session' } ) );

            expect( within( form ).getByRole( 'button', { name: 'Log session' } ) ).toBeDisabled();
            expect( within( form ).queryByText( 'Choose a topic.' ) ).not.toBeInTheDocument();
        } );

        it( 'uses the answer for the path chosen last', async () => {
            let answerDsa!: ( response: Response ) => void;

            api( {
                [`GET /me/enrollments/${DSA.id}`]: () => new Promise<Response>( ( resolve ) => {
                    answerDsa = resolve;
                } ),
            } );
            const user = userEvent.setup();

            renderApp( '/app/sessions?log' );

            const form = await screen.findByRole( 'form', { name: 'Log a study session' } );
            const topic = () => within( form ).getByLabelText( 'Topic' );

            await user.selectOptions( await within( form ).findByLabelText( 'Learning path' ), DSA.id );
            expect( within( topic() ).getByRole( 'option' ) ).toHaveTextContent( 'Loading topics…' );
            await user.selectOptions( within( form ).getByLabelText( 'Learning path' ), SYSTEM_DESIGN.id );
            await waitFor( () => expect( within( topic() ).getByRole( 'option', { name: 'Caching' } ) ).toBeInTheDocument() );

            answerDsa( json( 200, DSA_TREE ) );
            await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

            expect( within( topic() ).queryByRole( 'option', { name: 'Hashing Basics' } ) ).not.toBeInTheDocument();
            expect( within( topic() ).getByRole( 'option', { name: 'Caching' } ) ).toBeInTheDocument();
        } );

        it( 'says when a path\'s topics can\'t be loaded', async () => {
            api( { [`GET /me/enrollments/${DSA.id}`]: () => json( 500, { message: 'Oops' } ) } );
            const user = userEvent.setup();

            renderApp( '/app/sessions?log' );

            const form = await screen.findByRole( 'form', { name: 'Log a study session' } );

            await user.selectOptions( await within( form ).findByLabelText( 'Learning path' ), DSA.id );

            expect( await within( form ).findByText( 'Couldn\'t load this path. Choose it again.' ) ).toBeInTheDocument();
            expect( within( form ).getByLabelText( 'Topic' ) ).toBeDisabled();
        } );

        it( 'says when the learning paths can\'t be loaded', async () => {
            api( { 'GET /me/enrollments': () => json( 500, { message: 'Oops' } ) } );
            renderApp( '/app/sessions?log' );

            const form = await screen.findByRole( 'form', { name: 'Log a study session' } );

            expect( await within( form ).findByRole( 'alert' ) )
                .toHaveTextContent( 'Couldn\'t load your learning paths. Close this form and try again.' );
            expect( within( form ).queryByRole( 'button', { name: 'Log session' } ) ).not.toBeInTheDocument();
        } );

        it( 'shows the paths loading, and explains that time is logged against a path', async () => {
            let answer: () => Promise<Response> = pending;

            api( { 'GET /me/enrollments': () => answer() } );
            const user = userEvent.setup();

            renderApp( '/app/sessions?log' );
            expect( await screen.findByText( 'Loading your learning paths…' ) ).toBeInTheDocument();

            // A new user follows nothing yet: nothing to log against.
            answer = () => Promise.resolve( json( 200, [ DROPPED ] ) );
            await user.click( screen.getByRole( 'button', { name: 'Cancel' } ) );
            await user.click( screen.getByRole( 'button', { name: 'Log session' } ) );

            const form = screen.getByRole( 'form', { name: 'Log a study session' } );

            expect( await within( form ).findByText( /You aren't following any learning paths yet/ ) ).toBeInTheDocument();
            expect( within( form ).queryByRole( 'button', { name: 'Log session' } ) ).not.toBeInTheDocument();
        } );

        it( 'can be cancelled, and opened again from the button', async () => {
            api();
            const user = userEvent.setup();

            renderApp( '/app/sessions?log' );
            await within( await screen.findByRole( 'form', { name: 'Log a study session' } ) ).findByLabelText( 'Learning path' );
            // The page's own button hides while the form is open: this one is the form's.
            expect( screen.getAllByRole( 'button', { name: 'Log session' } ) ).toHaveLength( 1 );

            await user.click( screen.getByRole( 'button', { name: 'Cancel' } ) );
            expect( screen.queryByRole( 'form' ) ).not.toBeInTheDocument();

            await user.click( screen.getByRole( 'button', { name: 'Log session' } ) );
            expect( screen.getByRole( 'form', { name: 'Log a study session' } ) ).toBeInTheDocument();
        } );

        it( 'opens from the dashboard', async () => {
            api( {
                'GET /me/stats': () => json( 200, {
                    timeZone: 'UTC',
                    todayMinutes: 0,
                    weekMinutes: 0,
                    totalMinutes: 0,
                    currentStreakDays: 0,
                    longestStreakDays: 0,
                    itemsCompleted: 0,
                    last30Days: [],
                } ),
            } );
            renderApp( '/app' );

            await userEvent.setup().click( await screen.findByRole( 'link', { name: 'Log session' } ) );

            expect( screen.getByTestId( 'location' ) ).toHaveTextContent( '/app/sessions' );
            expect( await screen.findByRole( 'form', { name: 'Log a study session' } ) ).toBeInTheDocument();
        } );
    } );

    describe( 'editing a session', () => {
        it( 'changes the time, duration and notes of a session', async () => {
            const { calls } = api();
            const user = userEvent.setup();

            renderApp( '/app/sessions' );
            await screen.findByRole( 'region', { name: 'Today' } );
            await user.click( within( row( 'Two Sum' ) ).getByRole( 'button', { name: 'Edit' } ) );

            const form = screen.getByRole( 'form', { name: 'Edit session' } );

            expect( form ).toHaveTextContent( 'Two Sum · Hashing Basics' );
            expect( within( form ).queryByLabelText( 'Learning path' ) ).not.toBeInTheDocument();
            expect( within( form ).getByLabelText( 'Date' ) ).toHaveValue( '2026-09-29' );
            expect( within( form ).getByLabelText( 'Start time' ) ).toHaveValue( '08:00' );
            expect( within( form ).getByLabelText( 'Minutes' ) ).toHaveValue( 45 );
            expect( within( form ).getByLabelText( 'Notes (optional)' ) ).toHaveValue( 'Finally clicked!' );

            // Date and time pickers are set as a whole, not typed into.
            fireEvent.change( within( form ).getByLabelText( 'Date' ), { target: { value: '2026-09-28' } } );
            fireEvent.change( within( form ).getByLabelText( 'Start time' ), { target: { value: '18:30' } } );
            await user.clear( within( form ).getByLabelText( 'Minutes' ) );
            await user.type( within( form ).getByLabelText( 'Minutes' ), '50' );
            await user.clear( within( form ).getByLabelText( 'Notes (optional)' ) );
            await user.click( within( form ).getByRole( 'button', { name: 'Save changes' } ) );

            expect( await screen.findByText( 'Changes saved.' ) ).toBeInTheDocument();
            expect( calledWith( calls, 'PATCH', `/me/study-sessions/${uuid( 101 )}` )[0]?.body ).toEqual( {
                startedAt: '2026-09-28T18:30:00.000Z', durationMinutes: 50, notes: null,
            } );
            // Editing never loads the learning paths.
            expect( calledWith( calls, 'GET', '/me/enrollments' ) ).toHaveLength( 0 );
        } );

        it( 'names a session without an item by its topic', async () => {
            api();
            const user = userEvent.setup();

            renderApp( '/app/sessions' );
            await screen.findByRole( 'region', { name: 'Today' } );
            await user.click( within( row( 'Hashing Basics' ) ).getByRole( 'button', { name: 'Edit' } ) );

            expect( screen.getByRole( 'form', { name: 'Edit session' } ).querySelector( 'p' ) ).toHaveTextContent( /^Hashing Basics$/ );
        } );

        it( 'says when the session is gone, and can be cancelled', async () => {
            api( { [`PATCH /me/study-sessions/${uuid( 101 )}`]: () => json( 404, { message: 'Study session not found' } ) } );
            const user = userEvent.setup();

            renderApp( '/app/sessions' );
            await screen.findByRole( 'region', { name: 'Today' } );
            await user.click( within( row( 'Two Sum' ) ).getByRole( 'button', { name: 'Edit' } ) );
            await user.click( screen.getByRole( 'button', { name: 'Save changes' } ) );

            expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'This session no longer exists.' );

            await user.click( screen.getByRole( 'button', { name: 'Cancel' } ) );
            expect( screen.queryByRole( 'form' ) ).not.toBeInTheDocument();
            expect( row( 'Two Sum' ) ).toHaveTextContent( 'Finally clicked!' );
        } );
    } );

    describe( 'deleting a session', () => {
        it( 'asks first, then deletes and reloads', async () => {
            const { calls } = api();
            const user = userEvent.setup();

            renderApp( '/app/sessions' );
            await screen.findByRole( 'region', { name: 'Today' } );
            await user.click( within( row( 'Two Sum' ) ).getByRole( 'button', { name: 'Delete' } ) );

            expect( within( row( 'Two Sum' ) ).queryByRole( 'button', { name: 'Edit' } ) ).not.toBeInTheDocument();
            await user.click( confirmButton( 'Keep' ) );
            expect( calledWith( calls, 'DELETE', `/me/study-sessions/${uuid( 101 )}` ) ).toHaveLength( 0 );
            expect( within( row( 'Two Sum' ) ).getByRole( 'button', { name: 'Edit' } ) ).toBeInTheDocument();

            await user.click( within( row( 'Two Sum' ) ).getByRole( 'button', { name: 'Delete' } ) );
            await user.click( confirmButton( 'Delete' ) );

            expect( await screen.findByText( 'Session deleted.' ) ).toBeInTheDocument();
            expect( calledWith( calls, 'DELETE', `/me/study-sessions/${uuid( 101 )}` ) ).toHaveLength( 1 );
            await waitFor( () => expect( calledWith( calls, 'GET', '/me/study-sessions' ) ).toHaveLength( 2 ) );
        } );

        it( 'treats a session that is already gone as deleted', async () => {
            api( { [`DELETE /me/study-sessions/${uuid( 101 )}`]: () => json( 404, { message: 'Study session not found' } ) } );
            const user = userEvent.setup();

            renderApp( '/app/sessions' );
            await screen.findByRole( 'region', { name: 'Today' } );
            await user.click( within( row( 'Two Sum' ) ).getByRole( 'button', { name: 'Delete' } ) );
            await user.click( confirmButton( 'Delete' ) );

            expect( await screen.findByText( 'Session deleted.' ) ).toBeInTheDocument();
        } );

        it( 'waits while deleting', async () => {
            api( { [`DELETE /me/study-sessions/${uuid( 101 )}`]: pending } );
            const user = userEvent.setup();

            renderApp( '/app/sessions' );
            await screen.findByRole( 'region', { name: 'Today' } );
            await user.click( within( row( 'Two Sum' ) ).getByRole( 'button', { name: 'Delete' } ) );
            await user.click( confirmButton( 'Delete' ) );

            expect( confirmButton( 'Delete' ) ).toBeDisabled();
            expect( confirmButton( 'Keep' ) ).toBeDisabled();
        } );

        it( 'says when deleting fails, and lets the user try again', async () => {
            const answers = [ () => json( 500, { message: 'Oops' } ), pending ];

            api( { [`DELETE /me/study-sessions/${uuid( 101 )}`]: () => ( answers.shift() as () => Response )() } );
            const user = userEvent.setup();

            renderApp( '/app/sessions' );
            await screen.findByRole( 'region', { name: 'Today' } );
            await user.click( within( row( 'Two Sum' ) ).getByRole( 'button', { name: 'Delete' } ) );
            await user.click( confirmButton( 'Delete' ) );

            expect( await within( row( 'Two Sum' ) ).findByRole( 'alert' ) )
                .toHaveTextContent( 'Couldn\'t delete this session. Please try again.' );
            expect( confirmButton( 'Delete' ) ).toBeEnabled();

            await user.click( confirmButton( 'Delete' ) );
            expect( within( row( 'Two Sum' ) ).queryByRole( 'alert' ) ).not.toBeInTheDocument();
            expect( confirmButton( 'Delete' ) ).toBeDisabled();
        } );
    } );
} );
