import type { AnalyticsJson } from '@studylog/schemas';
import { Difficulty, EnrollmentStatus } from '@studylog/schemas/enums';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, loggedIn, mockApi, pending } from '../../test/api.ts';
import { enrollment, uuid } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';

const DSA = enrollment( 'Data Structures & Algorithms', EnrollmentStatus.Active, 20, 25, uuid( 201 ) );
const SYSTEM = enrollment( 'System Design Fundamentals', EnrollmentStatus.Paused, 5, 15, uuid( 202 ) );
const OLD = enrollment( 'Old Path', EnrollmentStatus.Dropped, 0, 3, uuid( 203 ) );

/** 12 weeks of study time, oldest first, ending with the week of Oct 19. */
const WEEKS = [ 160, 225, 105, 290, 320, 245, 180, 360, 275, 340, 205, 315 ].map( ( minutes, index ) => ( {
    weekStart: new Date( Date.UTC( 2026, 7, 3 + ( 7 * index ) ) ).toISOString().slice( 0, 10 ),
    minutes,
} ) );

const ANALYTICS: AnalyticsJson = {
    period: '30d',
    timeZone: 'UTC',
    from: '2026-09-20',
    to: '2026-10-19',
    totals: {
        minutes: 1300,
        previousMinutes: 1110,
        sessions: 34,
        itemsDone: 18,
        itemsDoneTotal: 42,
        topicsCompleted: 9,
        topicsTotal: 21,
        toRevise: 6,
    },
    weeks: WEEKS,
    byPath: [
        { enrollmentId: DSA.id, title: 'Data Structures & Algorithms', minutes: 850 },
        { enrollmentId: SYSTEM.id, title: 'System Design Fundamentals', minutes: 260 },
        { enrollmentId: uuid( 204 ), title: 'Interview Sprint', minutes: 150 },
        { enrollmentId: uuid( 205 ), title: 'Favourite Problems', minutes: 30 },
        { enrollmentId: uuid( 206 ), title: 'Graphs', minutes: 10 },
    ],
    itemStatus: { done: 42, revise: 6, inProgress: 5, notStarted: 22 },
    difficulty: [
        { difficulty: Difficulty.Easy, done: 14, total: 16 },
        { difficulty: Difficulty.Medium, done: 9, total: 18 },
        { difficulty: Difficulty.Hard, done: 1, total: 6 },
    ],
    habits: { sessions: 34, averageSessionMinutes: 38, bestWeekday: 'Sunday', mostActiveHours: { from: 18, to: 21 } },
    focus: [
        {
            enrollmentId: DSA.id,
            pathTitle: 'Data Structures & Algorithms',
            moduleTitle: 'Arrays & Hashing',
            topicId: uuid( 1 ),
            topicTitle: 'Sliding Window',
            completed: 1,
            total: 3,
            toRevise: 2,
            lastStudiedOn: '2026-10-10',
            next: [ { id: uuid( 11 ), title: 'Minimum Window Substring' }, { id: uuid( 12 ), title: 'Longest Repeating' } ],
        },
        {
            enrollmentId: DSA.id,
            pathTitle: 'Data Structures & Algorithms',
            moduleTitle: 'Trees',
            topicId: uuid( 2 ),
            topicTitle: 'Binary Search Trees',
            completed: 0,
            total: 2,
            toRevise: 0,
            lastStudiedOn: null,
            next: [],
        },
        {
            enrollmentId: SYSTEM.id,
            pathTitle: 'System Design Fundamentals',
            moduleTitle: 'Foundations',
            topicId: uuid( 3 ),
            topicTitle: 'Caching',
            completed: 4,
            total: 5,
            toRevise: 0,
            lastStudiedOn: '2026-09-28',
            next: [ { id: uuid( 13 ), title: 'Design an LRU Cache' } ],
        },
    ],
};

type Handlers = Parameters<typeof mockApi>[0];

function api( analytics: AnalyticsJson = ANALYTICS, handlers: Handlers = {} ) {
    return mockApi( {
        ...loggedIn,
        'GET /me/enrollments': () => json( 200, [ DSA, SYSTEM, OLD ] ),
        'GET /me/analytics': () => json( 200, analytics ),
        ...handlers,
    } );
}

/** A stat tile's values, by its label. */
const tile = ( label: string ) => screen.getAllByRole( 'term' ).find( ( term ) => term.textContent === label )?.parentElement;

const card = ( name: string ) => screen.getByRole( 'region', { name } );

describe( 'AnalyticsPage', () => {
    it( 'shows the headline numbers for the last 30 days, every path', async () => {
        const { calls } = api();

        renderApp( '/app/analytics' );

        expect( await screen.findByRole( 'heading', { level: 1, name: 'Analytics' } ) ).toBeInTheDocument();
        await screen.findByText( 'Time studied' );

        expect( tile( 'Time studied' ) ).toHaveTextContent( '21h 40m+3h 10m vs the 30 days before' );
        expect( tile( 'Items done' ) ).toHaveTextContent( '1842 in total' );
        // Dropped paths aren't counted or offered.
        await waitFor( () => expect( tile( 'Topics completed' ) ).toHaveTextContent( '9 of 21Across 2 paths' ) );
        expect( tile( 'To revise' ) ).toHaveTextContent( '6Items marked Revise' );
        expect( screen.queryByText( 'Loading your analytics…' ) ).not.toBeInTheDocument();

        const call = calls.find( ( recorded ) => recorded.path === '/me/analytics' );

        expect( Object.fromEntries( new URLSearchParams( call?.query ) ) ).toEqual( { period: '30d', timeZone: 'UTC' } );
        expect( screen.getByRole( 'button', { name: 'Last 30 days' } ) ).toHaveAttribute( 'aria-pressed', 'true' );
        expect( screen.getByRole( 'combobox', { name: 'Path' } ) ).toHaveValue( '' );
        expect( within( screen.getByRole( 'combobox', { name: 'Path' } ) ).getAllByRole( 'option' ).map( ( option ) => option.textContent ) )
            .toEqual( [ 'All paths', 'Data Structures & Algorithms', 'System Design Fundamentals' ] );
    } );

    it( 'charts study time per week, with the current week highlighted', async () => {
        api();
        renderApp( '/app/analytics' );

        const weekly = await screen.findByRole( 'region', { name: 'Study time per week' } );
        const weeks = within( weekly ).getByRole( 'list', { name: 'Minutes studied per week' } ).querySelectorAll( 'li' );

        expect( weekly ).toHaveTextContent( 'Average 4h 12m' );
        expect( weeks ).toHaveLength( 12 );
        expect( weeks[0] ).toHaveTextContent( 'Week of Aug 3: 2h 40m' );
        expect( weeks[7]?.querySelector( 'span span' ) ).toHaveStyle( { height: '100%' } );
        // Labels under some bars only.
        expect( [ ...weeks ].map( ( week ) => week.querySelector( '[aria-hidden="true"]:not(span span)' )?.textContent ) )
            .toEqual( [ 'Aug 3', '', '', 'Aug 24', '', '', 'Sep 14', '', '', 'Oct 5', '', 'Oct 19' ] );
        const bar = ( index: number ) => weeks[index]?.querySelector( 'span span' )?.className;

        expect( bar( 11 ) ).not.toBe( bar( 10 ) );
        expect( bar( 0 ) ).toBe( bar( 10 ) );
    } );

    it( 'shows where the time went, item status, difficulty and habits', async () => {
        api();
        renderApp( '/app/analytics' );

        const byPath = await screen.findByRole( 'region', { name: 'Where your time went' } );

        expect( byPath ).toHaveTextContent( 'Last 30 days' );
        expect( within( byPath ).getAllByRole( 'listitem' ).map( ( row ) => row.textContent ) ).toEqual( [
            'Data Structures & Algorithms14h 10m',
            'System Design Fundamentals4h 20m',
            'Interview Sprint2h 30m',
            'Favourite Problems30m',
            'Graphs10m',
        ] );
        // Bars are each path's share of the time; colors repeat after four paths.
        const fills = within( byPath ).getAllByRole( 'listitem' ).map( ( row ) => row.querySelector<HTMLElement>( '[aria-hidden] span' )!.style );

        expect( fills[0]?.width ).toBe( `${( 850 / 1300 ) * 100}%` );
        expect( fills[4]?.background ).toBe( fills[0]?.background );
        expect( fills[1]?.background ).not.toBe( fills[0]?.background );

        const status = card( 'Item status' );

        expect( status ).toHaveTextContent( '75 items you follow' );
        expect( status ).toHaveTextContent( '64%done' );
        expect( within( status ).getAllByRole( 'listitem' ).map( ( row ) => row.textContent ) )
            .toEqual( [ 'Done42', 'Revise6', 'In progress5', 'Not started22' ] );
        // The track and a segment for each of done, revise and in progress.
        expect( status.querySelectorAll( 'circle' ) ).toHaveLength( 4 );

        const difficulty = card( 'By difficulty' );

        expect( within( difficulty ).getAllByRole( 'listitem' ).map( ( row ) => row.textContent ) )
            .toEqual( [ 'Easy14/16 · 88%', 'Medium9/18 · 50%', 'Hard1/6 · 17%' ] );
        expect( within( difficulty ).getByText( 'Average session' ).closest( 'dl' ) ).toHaveTextContent( 'Average session38mBest daySundayMost active6–9 PMSessions34' );
    } );

    it( 'lists the topics that need focus, linking to each', async () => {
        api();
        renderApp( '/app/analytics' );

        const focus = await screen.findByRole( 'region', { name: 'Needs focus' } );
        const topics = within( focus ).getAllByRole( 'listitem' );

        expect( topics ).toHaveLength( 3 );
        expect( topics[0] ).toHaveTextContent( 'Sliding Window' );
        expect( topics[0] ).toHaveTextContent( 'Data Structures & Algorithms · Arrays & Hashing' );
        expect( topics[0] ).toHaveTextContent( '33%' );
        expect( topics[0] ).toHaveTextContent( '2 items to revise · last studied 9 days ago' );
        expect( topics[0] ).toHaveTextContent( 'Next: Minimum Window Substring' );
        expect( within( topics[0] ).getByRole( 'link', { name: 'Open Sliding Window' } ) )
            .toHaveAttribute( 'href', `/app/paths/${DSA.id}?topic=${uuid( 1 )}` );
        expect( topics[1] ).toHaveTextContent( '0%' );
        expect( topics[1] ).toHaveTextContent( 'Not started · 2 required items' );
        expect( topics[1] ).toHaveTextContent( 'Nothing left to start' );
        expect( topics[2] ).toHaveTextContent( '80%' );
        expect( topics[2] ).toHaveTextContent( '4 of 5 done · last studied 3 weeks ago' );

        // Red for nothing done, amber for some, green for most.
        const percentClass = ( row: HTMLElement ) => within( row ).getByText( /^\d+%$/ ).className;

        expect( new Set( topics.map( percentClass ) ).size ).toBe( 3 );
    } );

    it( 'changes the period and path, keeping them in the URL', async () => {
        const { calls } = api();
        const user = userEvent.setup();

        renderApp( '/app/analytics' );
        await screen.findByText( 'Time studied' );

        await user.click( screen.getByRole( 'button', { name: '90 days' } ) );
        await waitFor( () => expect( screen.getByRole( 'button', { name: '90 days' } ) ).toHaveAttribute( 'aria-pressed', 'true' ) );
        await waitFor( () => expect( screen.getByRole( 'option', { name: 'System Design Fundamentals' } ) ).toBeInTheDocument() );
        await user.selectOptions( screen.getByRole( 'combobox', { name: 'Path' } ), SYSTEM.id );

        await waitFor( () => expect( calls.filter( ( call ) => call.path === '/me/analytics' ) ).toHaveLength( 3 ) );
        expect( calls.filter( ( call ) => call.path === '/me/analytics' ).map( ( call ) => {
            const { period, enrollmentId } = Object.fromEntries( new URLSearchParams( call.query ) );

            return [ period, enrollmentId ];
        } ) ).toEqual( [ [ '30d', undefined ], [ '90d', undefined ], [ '90d', SYSTEM.id ] ] );
        expect( await screen.findByText( 'In this path' ) ).toBeInTheDocument();

        // Back to the defaults: nothing in the URL.
        await user.selectOptions( screen.getByRole( 'combobox', { name: 'Path' } ), '' );
        await user.click( screen.getByRole( 'button', { name: 'Last 30 days' } ) );
        await waitFor( () => expect( calls.filter( ( call ) => call.path === '/me/analytics' ) ).toHaveLength( 5 ) );
        expect( calls.at( -1 )?.query ).toBe( '?period=30d&timeZone=UTC' );
    } );

    it( 'starts from the period and path in the URL', async () => {
        const { calls } = api( { ...ANALYTICS, period: 'all', from: null, totals: { ...ANALYTICS.totals, previousMinutes: null } } );

        renderApp( `/app/analytics?period=all&path=${DSA.id}` );

        expect( await screen.findByText( 'All time', { selector: 'dd' } ) ).toBeInTheDocument();
        expect( card( 'Where your time went' ) ).toHaveTextContent( 'All time' );
        expect( screen.getByRole( 'button', { name: 'All time' } ) ).toHaveAttribute( 'aria-pressed', 'true' );
        expect( calls.find( ( call ) => call.path === '/me/analytics' )?.query ).toBe( `?period=all&enrollmentId=${DSA.id}&timeZone=UTC` );
    } );

    it( 'ignores an unknown period in the URL', async () => {
        const { calls } = api();

        renderApp( '/app/analytics?period=7d' );
        await screen.findByText( 'Time studied' );

        expect( calls.find( ( call ) => call.path === '/me/analytics' )?.query ).toBe( '?period=30d&timeZone=UTC' );
    } );

    it( 'explains empty sections for someone who hasn\'t studied yet', async () => {
        api( {
            ...ANALYTICS,
            totals: { ...ANALYTICS.totals, minutes: 0, previousMinutes: 0 },
            weeks: [ { weekStart: '2026-10-12', minutes: 0 } ],
            byPath: [],
            itemStatus: { done: 0, revise: 0, inProgress: 0, notStarted: 1 },
            difficulty: [],
            habits: { sessions: 0, averageSessionMinutes: 0, bestWeekday: null, mostActiveHours: null },
            focus: [],
        }, { 'GET /me/enrollments': () => json( 200, [ DSA ] ) } );
        renderApp( '/app/analytics' );

        expect( await screen.findByText( 'No study time in this period yet.' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Same as the 30 days before' ) ).toBeInTheDocument();
        expect( card( 'Study time per week' ) ).toHaveTextContent( 'Average 0m' );
        expect( card( 'Item status' ) ).toHaveTextContent( '1 item you follow' );
        expect( card( 'Item status' ).querySelectorAll( 'circle' ) ).toHaveLength( 1 );
        expect( screen.getByText( 'No items with a difficulty in these paths.' ) ).toBeInTheDocument();
        expect( card( 'By difficulty' ) ).toHaveTextContent( 'Average session—Best day—Most active—Sessions0' );
        expect( screen.getByText( 'Nothing needs attention right now. Nice work.' ) ).toBeInTheDocument();
        await waitFor( () => expect( tile( 'Topics completed' ) ).toHaveTextContent( 'In this path' ) );
    } );

    it( 'handles no weeks and no items at all', async () => {
        api( { ...ANALYTICS, weeks: [], itemStatus: { done: 0, revise: 0, inProgress: 0, notStarted: 0 } } );
        renderApp( '/app/analytics' );

        expect( await screen.findByText( 'No weeks yet' ) ).toBeInTheDocument();
        expect( card( 'Item status' ) ).toHaveTextContent( '0 items you follow' );
        expect( card( 'Item status' ) ).toHaveTextContent( '0%done' );
    } );

    it( 'shows a skeleton while loading', async () => {
        mockApi( { ...loggedIn, 'GET /me/enrollments': pending, 'GET /me/analytics': pending } );
        const { container } = renderApp( '/app/analytics' );

        expect( await screen.findByText( 'Loading your analytics…' ) ).toBeInTheDocument();
        // Grey cards in the page's shape.
        expect( container.querySelectorAll( '[aria-hidden="true"] span[style]' ).length ).toBeGreaterThan( 4 );
    } );

    it( 'still loads when the path list can\'t be loaded', async () => {
        api( ANALYTICS, { 'GET /me/enrollments': () => json( 500, {} ) } );
        renderApp( '/app/analytics' );

        expect( await screen.findByText( 'Time studied' ) ).toBeInTheDocument();
        expect( within( screen.getByRole( 'combobox', { name: 'Path' } ) ).getAllByRole( 'option' ) ).toHaveLength( 1 );
    } );

    it( 'says when loading failed, and tries again', async () => {
        let failures = 2;

        api( ANALYTICS, {
            'GET /me/analytics': () => {
                failures -= 1;

                return failures === 1 ? json( 500, {} ) : json( 200, ANALYTICS );
            },
        } );
        renderApp( '/app/analytics' );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong while loading your analytics. Please try again.' );
        await userEvent.setup().click( screen.getByRole( 'button', { name: 'Try again' } ) );
        expect( await screen.findByText( 'Time studied' ) ).toBeInTheDocument();
    } );

    it( 'says when StudyLog can\'t be reached', async () => {
        api( ANALYTICS, { 'GET /me/analytics': () => Promise.reject( new TypeError( 'Failed to fetch' ) ) } );
        renderApp( '/app/analytics' );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach StudyLog right now.' );
    } );

    it( 'ignores an answer that arrives after the filter changed', async () => {
        let answerFirst: ( response: Response ) => void = () => undefined;
        let first = true;

        api( ANALYTICS, {
            'GET /me/analytics': () => {
                if ( first ) {
                    first = false;

                    return new Promise<Response>( ( resolve ) => {
                        answerFirst = resolve;
                    } );
                }

                return json( 200, { ...ANALYTICS, period: '90d', totals: { ...ANALYTICS.totals, itemsDone: 7 } } );
            },
            'GET /me/enrollments': () => Promise.reject( new TypeError( 'Failed to fetch' ) ),
        } );
        const { unmount } = renderApp( '/app/analytics' );

        await userEvent.setup().click( await screen.findByRole( 'button', { name: '90 days' } ) );
        await waitFor( () => expect( tile( 'Items done' ) ).toHaveTextContent( '742 in total' ) );
        answerFirst( json( 200, ANALYTICS ) );
        await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
        expect( tile( 'Items done' ) ).toHaveTextContent( '742 in total' );
        unmount();
    } );
} );
