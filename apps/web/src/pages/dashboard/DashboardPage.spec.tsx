import type { EnrollmentJson, StudySessionPageJson, StudyStats } from '@studylog/schemas';
import { EnrollmentStatus, ItemType } from '@studylog/schemas/enums';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, loggedIn, mockApi, noContent, pending } from '../../test/api.ts';
import { enrollment, session } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';

// Tests run in UTC (see vitest.config.ts). "Now" is Tuesday Sep 29, 2026, 9:00 AM.
const NOW = new Date( '2026-09-29T09:00:00Z' );
const ID = '97f12719-9f4c-41c9-afc3-a91de613d02b';

/** The last 30 days, ending today (Sep 29), with minutes on the given days. */
function last30Days( minutes: Record<string, number> = {} ): StudyStats['last30Days'] {
    return Array.from( { length: 30 }, ( _, i ) => {
        const date = new Date( Date.UTC( 2026, 7, 31 + i ) ).toISOString().slice( 0, 10 );

        return { date, minutes: minutes[date] ?? 0 };
    } );
}

const STATS: StudyStats = {
    timeZone: 'UTC',
    todayMinutes: 45,
    weekMinutes: 95,
    totalMinutes: 1660,
    currentStreakDays: 1,
    longestStreakDays: 12,
    itemsCompleted: 13,
    last30Days: last30Days( { '2026-09-01': 30, '2026-09-28': 60, '2026-09-29': 45 } ),
};

const TOPIC = { id: ID, title: 'Hashing Basics' };
const ITEM = { id: ID, title: 'Two Sum', type: ItemType.Problem };

const SESSIONS: StudySessionPageJson = {
    total: 51,
    items: [
        session( 's1', '2026-09-29T08:00:00.000Z', 45, { topic: TOPIC, item: ITEM, notes: 'Finally clicked!' } ),
        session( 's2', '2026-09-28T17:30:00.000Z', 60, { topic: TOPIC } ),
        session( 's3', '2026-09-27T10:15:00.000Z', 30, { item: ITEM } ),
        session( 's4', '2026-09-26T10:00:00.000Z', 20 ),
    ],
};

/** The API with a logged-in user and these dashboard answers. */
function api( { stats = STATS, enrollments = [] as EnrollmentJson[], sessions = SESSIONS } = {} ) {
    return mockApi( {
        ...loggedIn,
        'GET /me/stats': () => json( 200, stats ),
        'GET /me/enrollments': () => json( 200, enrollments ),
        'GET /me/study-sessions': () => json( 200, sessions ),
        'POST /auth/logout': () => noContent(),
    } );
}

describe( 'DashboardPage', () => {
    beforeEach( () => {
        vi.useFakeTimers( { toFake: [ 'Date' ] } );
        vi.setSystemTime( NOW );
    } );

    afterEach( () => {
        vi.useRealTimers();
    } );

    it( 'greets the user and shows their numbers', async () => {
        api();
        renderApp( '/app' );

        expect( await screen.findByRole( 'heading', { level: 1 } ) ).toHaveTextContent( 'Good morning, Sam' );
        await screen.findByText( 'Items completed' );

        // A tile is the term (its label) with its values, e.g. "Today" and "45m".
        const tile = ( label: string ) => {
            const term = screen.getAllByRole( 'term' ).find( ( element ) => element.textContent === label );

            return term?.parentElement;
        };

        expect( tile( 'Today' ) ).toHaveTextContent( '45m' );
        // Each tile: value and a detail line.
        expect( tile( 'Today' )?.querySelectorAll( 'dd' ) ).toHaveLength( 2 );
        expect( tile( 'Today' ) ).toHaveTextContent( '45m−15m vs yesterday' );
        expect( screen.queryByText( 'Loading your dashboard…' ) ).not.toBeInTheDocument();
        expect( tile( 'This week' ) ).toHaveTextContent( '1h 35mMon–Sun' );
        expect( tile( 'Streak' ) ).toHaveTextContent( '1 dayBest: 12 days' );
        expect( tile( 'Total' ) ).toHaveTextContent( '27h 40mAll time' );
        expect( tile( 'Items completed' ) ).toHaveTextContent( '13Across 0 paths' );
    } );

    it( 'says how the week is going, or how to start', async () => {
        const active = enrollment( 'Data Structures & Algorithms', EnrollmentStatus.Active, 2, 7 );
        const dropped = enrollment( 'Old Path', EnrollmentStatus.Dropped, 0, 3 );

        // While loading.
        mockApi( { ...loggedIn, 'GET /me/stats': pending, 'GET /me/enrollments': pending, 'GET /me/study-sessions': pending } );
        const loading = renderApp( '/app' );

        expect( await screen.findByText( 'Here\'s how your studying is going.' ) ).toBeInTheDocument();
        loading.unmount();

        // Someone without paths (dropped ones don't count).
        api();
        const first = renderApp( '/app' );

        expect( await screen.findByText( 'Welcome to StudyLog. Pick a learning path to get started.' ) ).toBeInTheDocument();
        first.unmount();

        api( { enrollments: [ active, dropped ] } );
        const second = renderApp( '/app' );

        expect( await screen.findByText( 'You\'ve studied 1h 35m this week. Keep the streak going.' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Across 1 path' ) ).toBeInTheDocument();
        second.unmount();

        api( { enrollments: [ active, enrollment( 'Graphs', EnrollmentStatus.Paused, 1, 4 ) ], stats: { ...STATS, weekMinutes: 0, todayMinutes: 0, last30Days: [] } } );
        renderApp( '/app' );

        expect( await screen.findByText( 'Nothing logged this week yet. A short session keeps the streak going.' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Same as yesterday' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Across 2 paths' ) ).toBeInTheDocument();
    } );

    it( 'compares today with yesterday', async () => {
        api( { stats: { ...STATS, todayMinutes: 95, last30Days: last30Days( { '2026-09-28': 65, '2026-09-29': 95 } ) } } );
        renderApp( '/app' );

        expect( await screen.findByText( '+30m vs yesterday' ) ).toBeInTheDocument();
    } );

    it( 'asks for stats in the browser\'s time zone, and a few recent sessions', async () => {
        const { calls } = api();

        renderApp( '/app' );
        await screen.findByText( 'Items completed' );

        const call = ( path: string ) => calls.find( ( recorded ) => recorded.path === path );

        expect( call( '/me/stats' ) ).toMatchObject( { query: '?timeZone=UTC', headers: { Authorization: 'Bearer restored-token' } } );
        expect( call( '/me/study-sessions' )?.query ).toBe( '?limit=3' );
        expect( call( '/me/enrollments' ) ).toBeDefined();
    } );

    it( 'charts the last 30 days, with the minutes of each day for screen readers', async () => {
        api();
        renderApp( '/app' );

        const chart = await screen.findByRole( 'list', { name: 'Minutes studied per day' } );
        const days = within( chart ).getAllByRole( 'listitem' );

        expect( screen.getByText( '2h 15m over 3 days.' ) ).toBeInTheDocument();
        expect( days ).toHaveLength( 30 );
        expect( days[0] ).toHaveTextContent( 'Aug 31: 0m' );
        expect( days[1] ).toHaveTextContent( 'Sep 1: 30m' );
        expect( days[29] ).toHaveTextContent( 'Sep 29: 45m' );
        // The busiest day fills the chart; the others are scaled to it. Empty days get a stub, not a height.
        const bar = ( index: number ) => days[index]?.firstChild as HTMLElement;

        expect( bar( 28 ).style.height ).toBe( '100%' );
        expect( bar( 29 ).style.height ).toBe( '75%' );
        expect( bar( 0 ).style.height ).toBe( '' );
        expect( bar( 0 ).className ).not.toBe( bar( 1 ).className );
    } );

    it( 'lists learning paths in dashboard order with progress, leaving dropped ones out', async () => {
        api( {
            enrollments: [
                enrollment( 'Data Structures & Algorithms', EnrollmentStatus.Active, 13, 19 ),
                enrollment( 'System Design Fundamentals', EnrollmentStatus.Paused, 1, 6 ),
                enrollment( 'Interview Sprint', EnrollmentStatus.Completed, 5, 5 ),
                enrollment( 'Given Up', EnrollmentStatus.Dropped, 0, 3 ),
                enrollment( 'Nothing Published Yet', EnrollmentStatus.Active, 0, 0 ),
            ],
        } );
        renderApp( '/app' );

        const paths = within( await screen.findByRole( 'region', { name: 'Your learning paths' } ) ).getAllByRole( 'listitem' );

        expect( paths.map( ( path ) => path.querySelector( 'h3' )?.textContent ) ).toEqual( [
            'Data Structures & Algorithms',
            'System Design Fundamentals',
            'Interview Sprint',
            'Nothing Published Yet',
        ] );
        expect( paths[0] ).toHaveTextContent( '68%13 of 19 items done' );
        expect( paths[1] ).toHaveTextContent( 'System Design FundamentalsPaused17%' );
        expect( paths[2] ).toHaveTextContent( 'Interview SprintCompleted100%' );
        expect( paths[3] ).toHaveTextContent( '0%0 of 0 items done' );
        expect( screen.getByRole( 'progressbar', { name: 'Data Structures & Algorithms progress' } ) )
            .toHaveAttribute( 'aria-valuenow', '68' );
        expect( screen.queryByText( 'Active' ) ).not.toBeInTheDocument();
        expect( paths[0]?.querySelector( 'div' )?.children ).toHaveLength( 2 ); // title and percentage, no status
        expect( paths[1]?.querySelector( 'div' )?.children ).toHaveLength( 3 );
        expect( ( screen.getByRole( 'progressbar', { name: 'Interview Sprint progress' } ).firstChild as HTMLElement ).style.width )
            .toBe( '100%' );
        expect( screen.queryByText( /aren't following/ ) ).not.toBeInTheDocument();
    } );

    it( 'lists recent sessions with what was studied, when, for how long, and notes', async () => {
        api();
        renderApp( '/app' );

        const region = await screen.findByRole( 'region', { name: 'Recent sessions' } );
        const sessions = within( region ).getAllByRole( 'listitem' );

        expect( within( region ).getByRole( 'link', { name: 'View all 51' } ) ).toHaveAttribute( 'href', '/app/sessions' );
        expect( sessions[0] ).toHaveTextContent( 'Two SumHashing Basics · Today, 8:00 AMFinally clicked!45m' );
        expect( sessions[1] ).toHaveTextContent( 'Hashing BasicsYesterday, 5:30 PM1h' );
        expect( sessions[0]?.querySelectorAll( 'p' ) ).toHaveLength( 3 );
        expect( sessions[1]?.querySelectorAll( 'p' ) ).toHaveLength( 2 );
        expect( screen.queryByText( /No study sessions yet/ ) ).not.toBeInTheDocument();
        expect( sessions[2] ).toHaveTextContent( 'Two SumSun, Sep 27, 10:15 AM30m' );
        expect( sessions[3] ).toHaveTextContent( 'Study sessionSat, Sep 26, 10:00 AM20m' );
    } );

    it( 'shows friendly empty states for a new user', async () => {
        api( {
            stats: { ...STATS, todayMinutes: 0, weekMinutes: 0, totalMinutes: 0, last30Days: last30Days() },
            enrollments: [ enrollment( 'Given Up', EnrollmentStatus.Dropped, 0, 3 ) ],
            sessions: { total: 0, items: [] },
        } );
        renderApp( '/app' );

        expect( await screen.findByText( 'You aren\'t following any learning paths yet.' ) ).toBeInTheDocument();
        expect( screen.getByText( 'No study sessions yet. Time you log will show up here.' ) ).toBeInTheDocument();
        expect( screen.getByText( 'No study time in the last 30 days yet.' ) ).toBeInTheDocument();
        expect( within( screen.getByRole( 'region', { name: 'Your learning paths' } ) ).queryByRole( 'list' ) ).not.toBeInTheDocument();
        expect( within( screen.getByRole( 'region', { name: 'Recent sessions' } ) ).queryByRole( 'list' ) ).not.toBeInTheDocument();
        expect( screen.queryByRole( 'link', { name: /View all/ } ) ).not.toBeInTheDocument();
    } );

    it( 'shows a loading state while the dashboard loads', async () => {
        mockApi( { ...loggedIn, 'GET /me/stats': pending, 'GET /me/enrollments': pending, 'GET /me/study-sessions': pending } );
        renderApp( '/app' );

        // Once the session is restored (the app shows its own loading screen until then).
        expect( ( await screen.findByText( 'Loading your dashboard…' ) ).closest( '[role="status"]' ) ).not.toBeNull();
    } );

    it( 'says when the API can\'t be reached, and loads again on retry', async () => {
        let online = false;
        let answer!: ( response: Response ) => void;

        mockApi( {
            ...loggedIn,
            'GET /me/stats': () => ( online
                ? new Promise<Response>( ( resolve ) => {
                        answer = resolve;
                    } )
                : Promise.reject( new TypeError( 'Failed to fetch' ) ) ),
            'GET /me/enrollments': () => json( 200, [] ),
            'GET /me/study-sessions': () => json( 200, SESSIONS ),
        } );
        renderApp( '/app' );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach StudyLog right now.' );

        online = true;
        await userEvent.setup().click( screen.getByRole( 'button', { name: 'Try again' } ) );

        expect( screen.getByText( 'Loading your dashboard…' ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();

        await waitFor( () => expect( answer ).toBeDefined() );
        answer( json( 200, STATS ) );
        expect( await screen.findByText( 'Items completed' ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();
    } );

    it( 'shows a general error when the API fails', async () => {
        mockApi( {
            ...loggedIn,
            'GET /me/stats': () => json( 500, { statusCode: 500, message: 'Internal server error' } ),
            'GET /me/enrollments': () => json( 200, [] ),
            'GET /me/study-sessions': () => json( 200, SESSIONS ),
        } );
        renderApp( '/app' );

        expect( await screen.findByRole( 'alert' ) )
            .toHaveTextContent( 'Something went wrong while loading your dashboard. Please try again.' );
    } );

    it( 'shows who is logged in, and logs out to the homepage', async () => {
        const { calls } = api();

        renderApp( '/app' );
        expect( await screen.findByText( 'Sam Khan' ) ).toBeInTheDocument();
        expect( within( screen.getByRole( 'banner' ) ).getByText( /^SK$/ ) ).toBeInTheDocument();
        expect( screen.getByText( 'sam@example.com' ) ).toBeInTheDocument();
        await userEvent.setup().click( screen.getByRole( 'button', { name: 'Log out' } ) );

        await waitFor( () => expect( screen.getByTestId( 'location' ) ).toHaveTextContent( /^\/$/ ) );
        expect( screen.getByRole( 'heading', { level: 1 } ) ).toHaveTextContent( 'Study with a plan.' );
        expect( calls.at( -1 ) ).toMatchObject( { path: '/auth/logout' } );
    } );
} );
