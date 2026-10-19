import type { EnrollmentDetailJson } from '@studylog/schemas';
import { Difficulty, EnrollmentStatus, ItemType, ProgressStatus } from '@studylog/schemas/enums';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { RecordedCall } from '../../test/api.ts';
import { json, loggedIn, mockApi, pending } from '../../test/api.ts';
import type { TreeSpec } from '../../test/fixtures.ts';
import { enrollment, enrollmentDetail, uuid } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';

// Tests run in UTC (see vitest.config.ts). "Now" is Tuesday Sep 29, 2026, 9:00 AM.
const NOW = new Date( '2026-09-29T09:00:00Z' );

const DSA = enrollment( 'Data Structures & Algorithms', EnrollmentStatus.Active, 2, 7, uuid( 201 ) );
const URL = `/me/enrollments/${DSA.id}`;

const TWO_SUM = uuid( 11 );
const HASH_TABLES = uuid( 12 );
const DUMMY_HEAD = uuid( 31 );
const INORDER = uuid( 41 );
const CLRS = uuid( 42 );

function modules( twoSum = ProgressStatus.Done ): TreeSpec[] {
    return [
        {
            title: 'Arrays & Hashing',
            description: 'Most problems start here.',
            topics: [
                {
                    id: uuid( 1 ),
                    title: 'Hashing Basics',
                    items: [
                        {
                            id: TWO_SUM,
                            title: 'Two Sum',
                            difficulty: Difficulty.Easy,
                            estimatedMinutes: 15,
                            details: { url: 'https://leetcode.com/problems/two-sum/', platform: 'leetcode' },
                            progress: twoSum,
                        },
                        {
                            id: HASH_TABLES,
                            title: 'Hash Tables Explained',
                            type: ItemType.Article,
                            optional: true,
                            details: { url: 'https://en.wikipedia.org/wiki/Hash_table' },
                        },
                        { id: uuid( 13 ), title: 'Contains Duplicate', progress: ProgressStatus.Revise },
                    ],
                },
                {
                    id: uuid( 2 ),
                    title: 'Two Pointers',
                    description: 'Two indexes moving through the array.',
                    items: [ { id: uuid( 21 ), title: '3Sum', progress: ProgressStatus.InProgress } ],
                },
            ],
        },
        {
            title: 'Linked Lists',
            topics: [
                {
                    id: uuid( 3 ),
                    title: 'Linked List Basics',
                    items: [ {
                        id: DUMMY_HEAD,
                        title: 'The Dummy Head Trick',
                        type: ItemType.Note,
                        details: { content: 'Start with a dummy node.\nReturn dummy.next.' },
                    } ],
                },
            ],
        },
        {
            title: 'Trees',
            topics: [
                {
                    id: uuid( 4 ),
                    title: 'Tree Traversals',
                    items: [
                        {
                            id: INORDER,
                            title: 'Iterative Inorder Traversal',
                            type: ItemType.Exercise,
                            details: { instructions: 'Write it without recursion.', answer: 'Use a stack.' },
                        },
                        {
                            id: CLRS,
                            title: 'Introduction to Algorithms',
                            type: ItemType.Book,
                            estimatedMinutes: 90,
                            details: { author: 'Cormen et al.', chapters: 'Ch. 12' },
                        },
                    ],
                },
                { id: uuid( 5 ), title: 'Graphs', items: [] },
            ],
        },
    ];
}

const TREE = enrollmentDetail( DSA, modules() );

type Handlers = Parameters<typeof mockApi>[0];

function api( handlers: Handlers = {} ) {
    return mockApi( {
        ...loggedIn,
        [`GET ${URL}`]: () => json( 200, TREE ),
        [`PUT /me/progress/${TWO_SUM}`]: () => json( 200, { itemId: TWO_SUM, status: 'in_progress' } ),
        ...handlers,
    } );
}

const calledWith = ( calls: RecordedCall[], method: string, path: string ) =>
    calls.filter( ( call ) => call.method === method && call.path === path );

/** A module's card, by its title. */
const module = ( title: string ) => screen.getByRole( 'region', { name: title } );

/** A topic's collapsible section, by its title. */
const topic = ( title: string ) => screen.getByRole( 'heading', { level: 3, name: title } ).closest( 'details' )!;

/** An item's row, by its title (the first one, if it appears in several topics). */
const item = ( title: string ) => screen.getAllByText( title, { selector: 'p' } )[0]?.closest( 'li' ) as HTMLElement;

describe( 'PathPage', () => {
    beforeEach( () => {
        vi.useFakeTimers( { toFake: [ 'Date' ] } );
        vi.setSystemTime( NOW );
    } );

    afterEach( () => {
        vi.useRealTimers();
    } );

    it( 'shows the path with progress at every level', async () => {
        api();
        renderApp( `/app/paths/${DSA.id}` );

        expect( await screen.findByRole( 'heading', { level: 1 } ) ).toHaveTextContent( 'Data Structures & Algorithms' );
        expect( screen.getByRole( 'progressbar', { name: 'Data Structures & Algorithms progress' } ) ).toHaveAttribute( 'aria-valuenow', '29' );
        expect( screen.getByText( '2 of 7 items done · 29%' ) ).toBeInTheDocument();
        expect( screen.queryByText( 'Paused' ) ).not.toBeInTheDocument();
        expect( screen.getByRole( 'heading', { level: 1 } ).parentElement?.children ).toHaveLength( 1 ); // no status badge
        expect( screen.queryByText( 'Loading the learning path…' ) ).not.toBeInTheDocument();

        expect( screen.getAllByRole( 'heading', { level: 2 } ).map( ( heading ) => heading.textContent ) )
            .toEqual( [ 'Arrays & Hashing', 'Linked Lists', 'Trees' ] );
        expect( module( 'Arrays & Hashing' ) ).toHaveTextContent( '2 of 3 done' );
        expect( module( 'Arrays & Hashing' ) ).toHaveTextContent( 'Most problems start here.' );
        expect( screen.getByRole( 'progressbar', { name: 'Arrays & Hashing progress' } ) ).toHaveAttribute( 'aria-valuenow', '67' );
        expect( module( 'Linked Lists' ).querySelectorAll( 'p' )[0] ).toHaveTextContent( '0 of 1 done' );
        // No description: no empty line either.
        expect( module( 'Linked Lists' ).querySelectorAll( ':scope > p' ) ).toHaveLength( 0 );
        expect( module( 'Arrays & Hashing' ).querySelectorAll( ':scope > p' ) ).toHaveLength( 1 );

        // Optional items don't count; a finished topic's count stands out.
        expect( topic( 'Hashing Basics' ).querySelector( 'summary' ) ).toHaveTextContent( 'Hashing Basics2/2' );
        expect( topic( 'Two Pointers' ).querySelector( 'summary' ) ).toHaveTextContent( 'Two Pointers0/1' );
        expect( topic( 'Hashing Basics' ).querySelector( 'summary span' )?.className )
            .not.toBe( topic( 'Two Pointers' ).querySelector( 'summary span' )?.className );
        expect( topic( 'Graphs' ).querySelector( 'summary span' )?.className )
            .toBe( topic( 'Two Pointers' ).querySelector( 'summary span' )?.className );
        expect( topic( 'Two Pointers' ) ).toHaveTextContent( 'Two indexes moving through the array.' );
        expect( topic( 'Graphs' ) ).toHaveTextContent( 'No items in this topic yet.' );
        expect( within( topic( 'Graphs' ) ).queryByRole( 'list' ) ).not.toBeInTheDocument();
        expect( topic( 'Hashing Basics' ).querySelectorAll( ':scope > p' ) ).toHaveLength( 0 );
        expect( topic( 'Hashing Basics' ) ).not.toHaveTextContent( 'No items' );
    } );

    it( 'opens the first unfinished topic', async () => {
        api();
        renderApp( `/app/paths/${DSA.id}` );
        await screen.findByRole( 'heading', { level: 1 } );

        expect( topic( 'Hashing Basics' ).open ).toBe( false );
        expect( topic( 'Two Pointers' ).open ).toBe( true );
        expect( topic( 'Linked List Basics' ).open ).toBe( false );

        await userEvent.setup().click( within( topic( 'Hashing Basics' ) ).getByText( 'Hashing Basics' ) );
        expect( topic( 'Hashing Basics' ).open ).toBe( true );
    } );

    it( 'describes each item and where to study it', async () => {
        api();
        const user = userEvent.setup();

        renderApp( `/app/paths/${DSA.id}` );
        await screen.findByRole( 'heading', { level: 1 } );

        expect( item( 'Two Sum' ) ).toHaveTextContent( 'Problem · Easy · 15 min' );
        expect( within( item( 'Two Sum' ) ).getByRole( 'link', { name: 'Open on leetcode (opens in a new tab)' } ) ).toMatchObject( {
            href: 'https://leetcode.com/problems/two-sum/',
            target: '_blank',
            rel: 'noreferrer',
        } );
        expect( item( 'Hash Tables Explained' ) ).toHaveTextContent( 'Article · Optional' );
        expect( within( item( 'Hash Tables Explained' ) ).getByRole( 'link', { name: /^Open/ } ) ).toBeInTheDocument();
        expect( item( 'Introduction to Algorithms' ) ).toHaveTextContent( 'Book · 90 min · Cormen et al. · Ch. 12' );
        expect( within( item( 'Introduction to Algorithms' ) ).queryByRole( 'link', { name: /^Open/ } ) ).not.toBeInTheDocument();
        expect( item( 'Contains Duplicate' ).querySelector( 'details' ) ).toBeNull();

        // Notes and exercises are read here; an exercise's answer stays hidden until asked for.
        const note = within( item( 'The Dummy Head Trick' ) ).getByText( 'Show note' ).closest( 'details' )!;

        expect( note ).toHaveTextContent( 'Start with a dummy node.' );
        expect( note.querySelector( 'details' ) ).toBeNull();

        const exercise = within( item( 'Iterative Inorder Traversal' ) ).getByText( 'Show instructions' ).closest( 'details' )!;
        const answer = within( exercise ).getByText( 'Show answer' ).closest( 'details' )!;

        expect( exercise ).toHaveTextContent( 'Write it without recursion.' );
        expect( answer.open ).toBe( false );
        await user.click( within( answer ).getByText( 'Show answer' ) );
        expect( answer.open ).toBe( true );
        expect( answer ).toHaveTextContent( 'Use a stack.' );
    } );

    it( 'shows each item\'s status, and links to logging time on it', async () => {
        api();
        renderApp( `/app/paths/${DSA.id}` );
        await screen.findByRole( 'heading', { level: 1 } );

        const status = ( title: string ) => screen.getByRole( 'combobox', { name: `Status of ${title}` } );

        expect( status( 'Two Sum' ) ).toHaveValue( 'done' );
        expect( status( '3Sum' ) ).toHaveValue( 'in_progress' );
        expect( status( 'Contains Duplicate' ) ).toHaveValue( 'revise' );
        expect( status( 'Hash Tables Explained' ) ).toHaveValue( 'not_started' );
        expect( within( status( 'Two Sum' ) ).getAllByRole( 'option' ).map( ( option ) => option.textContent ) )
            .toEqual( [ 'Not started', 'In progress', 'Done', 'Revise' ] );
        // Each status looks different.
        const dots = [ 'Two Sum', '3Sum', 'Contains Duplicate', 'Hash Tables Explained' ]
            .map( ( title ) => item( title ).querySelector( 'span' )?.className );

        expect( new Set( dots ).size ).toBe( 4 );

        expect( within( item( 'Two Sum' ) ).getByRole( 'link', { name: 'Log time' } ) )
            .toHaveAttribute( 'href', `/app/sessions?log&path=${DSA.id}&topic=${uuid( 1 )}&item=${TWO_SUM}` );
    } );

    it( 'saves a new status, then shows the new counts', async () => {
        const updated = enrollmentDetail( DSA, modules( ProgressStatus.InProgress ) );
        const answers = [ () => json( 200, TREE ), () => json( 200, updated ) ];
        const { calls } = api( { [`GET ${URL}`]: () => ( answers.shift() as () => Response )() } );
        const user = userEvent.setup();

        renderApp( `/app/paths/${DSA.id}` );
        await screen.findByRole( 'heading', { level: 1 } );
        await user.selectOptions( screen.getByRole( 'combobox', { name: 'Status of Two Sum' } ), 'in_progress' );

        await waitFor( () => expect( topic( 'Hashing Basics' ).querySelector( 'summary' ) ).toHaveTextContent( '1/2' ) );
        expect( calledWith( calls, 'PUT', `/me/progress/${TWO_SUM}` )[0]?.body ).toEqual( { status: 'in_progress' } );
        expect( screen.getByRole( 'combobox', { name: 'Status of Two Sum' } ) ).toHaveValue( 'in_progress' );
        expect( screen.getByRole( 'combobox', { name: 'Status of Two Sum' } ) ).toBeEnabled();
        expect( module( 'Arrays & Hashing' ) ).toHaveTextContent( '1 of 3 done' );
        // The topic the user is working in stays as it was.
        expect( topic( 'Two Pointers' ).open ).toBe( true );
    } );

    it( 'waits while saving', async () => {
        api( { [`PUT /me/progress/${TWO_SUM}`]: pending } );
        const user = userEvent.setup();

        renderApp( `/app/paths/${DSA.id}` );
        await screen.findByRole( 'heading', { level: 1 } );
        await user.selectOptions( screen.getByRole( 'combobox', { name: 'Status of Two Sum' } ), 'revise' );

        expect( screen.getByRole( 'combobox', { name: 'Status of Two Sum' } ) ).toBeDisabled();
    } );

    it( 'says when a status couldn\'t be saved, and keeps the old one', async () => {
        const answers = [ () => json( 500, { message: 'Oops' } ), pending ];

        api( { [`PUT /me/progress/${TWO_SUM}`]: () => ( answers.shift() as () => Response | Promise<Response> )() } );
        const user = userEvent.setup();

        renderApp( `/app/paths/${DSA.id}` );
        await screen.findByRole( 'heading', { level: 1 } );
        await user.selectOptions( screen.getByRole( 'combobox', { name: 'Status of Two Sum' } ), 'not_started' );

        expect( await within( item( 'Two Sum' ) ).findByRole( 'alert' ) ).toHaveTextContent( 'Couldn\'t save your progress. Please try again.' );
        expect( screen.getByRole( 'combobox', { name: 'Status of Two Sum' } ) ).toHaveValue( 'done' );
        expect( screen.getByRole( 'combobox', { name: 'Status of Two Sum' } ) ).toBeEnabled();

        // Trying again clears the message.
        await user.selectOptions( screen.getByRole( 'combobox', { name: 'Status of Two Sum' } ), 'not_started' );
        expect( within( item( 'Two Sum' ) ).queryByRole( 'alert' ) ).not.toBeInTheDocument();
    } );

    it( 'keeps the page when the new counts can\'t be loaded', async () => {
        const answers = [ () => json( 200, TREE ), () => json( 500, { message: 'Oops' } ) ];
        const { calls } = api( { [`GET ${URL}`]: () => ( answers.shift() as () => Response )() } );
        const user = userEvent.setup();

        renderApp( `/app/paths/${DSA.id}` );
        await screen.findByRole( 'heading', { level: 1 } );
        await user.selectOptions( screen.getByRole( 'combobox', { name: 'Status of Two Sum' } ), 'in_progress' );

        await waitFor( () => expect( calledWith( calls, 'GET', URL ) ).toHaveLength( 2 ) );
        await waitFor( () => expect( screen.getByRole( 'combobox', { name: 'Status of Two Sum' } ) ).toBeEnabled() );
        expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();
        expect( screen.getByRole( 'heading', { level: 1 } ) ).toBeInTheDocument();
    } );

    it( 'shows the enrollment\'s status, and paths without a description or content', async () => {
        const paused = enrollment( 'Empty Path', EnrollmentStatus.Paused, 0, 0, uuid( 202 ) );

        api( { [`GET /me/enrollments/${paused.id}`]: () => json( 200, enrollmentDetail( paused, [] ) ) } );
        renderApp( `/app/paths/${paused.id}` );

        expect( await screen.findByText( 'Paused' ) ).toBeInTheDocument();
        expect( screen.getByText( 'This path has no content yet.' ) ).toBeInTheDocument();
        expect( screen.getByText( '0 of 0 items done · 0%' ) ).toBeInTheDocument();
        // The two lines are the counts and "no content": no empty description line.
        expect( screen.getByRole( 'main' ).querySelectorAll( 'p' ) ).toHaveLength( 2 );
    } );

    it( 'shows the path\'s description when it has one', async () => {
        const withDescription: EnrollmentDetailJson = { ...TREE, learningPath: { ...TREE.learningPath, description: 'Interview patterns.' } };

        api( { [`GET ${URL}`]: () => json( 200, withDescription ) } );
        renderApp( `/app/paths/${DSA.id}` );

        expect( await screen.findByText( 'Interview patterns.' ) ).toBeInTheDocument();
        expect( screen.queryByText( 'This path has no content yet.' ) ).not.toBeInTheDocument();
    } );

    it( 'shows a loading state', async () => {
        api( { [`GET ${URL}`]: pending } );
        renderApp( `/app/paths/${DSA.id}` );

        expect( await screen.findByText( 'Loading the learning path…' ) ).toBeInTheDocument();
        expect( screen.getByRole( 'link', { name: '← Dashboard' } ) ).toHaveAttribute( 'href', '/app' );
    } );

    it.each( [ 404, 400 ] )( 'says when the path isn\'t on the user\'s list (%i)', async ( status ) => {
        api( { [`GET ${URL}`]: () => json( status, { message: 'Enrollment not found' } ) } );
        renderApp( `/app/paths/${DSA.id}` );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'This learning path isn\'t on your list.' );
        expect( screen.queryByRole( 'button', { name: 'Try again' } ) ).not.toBeInTheDocument();
    } );

    it( 'says when the API can\'t be reached, and loads again on retry', async () => {
        const answers = [ () => Promise.reject( new TypeError( 'Failed to fetch' ) ), pending, () => json( 200, TREE ) ];

        api( { [`GET ${URL}`]: () => ( answers.shift() as () => Response | Promise<Response> )() } );
        renderApp( `/app/paths/${DSA.id}` );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach StudyLog right now.' );
        await userEvent.setup().click( screen.getByRole( 'button', { name: 'Try again' } ) );
        expect( screen.getByText( 'Loading the learning path…' ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();
    } );

    it( 'shows a general error when the API fails', async () => {
        api( { [`GET ${URL}`]: () => json( 500, { message: 'Oops' } ) } );
        renderApp( `/app/paths/${DSA.id}` );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong while loading this path. Please try again.' );
        expect( screen.getByRole( 'button', { name: 'Try again' } ) ).toBeInTheDocument();
    } );

    it( 'opens from the dashboard', async () => {
        api( {
            'GET /me/stats': () => json( 200, {
                timeZone: 'UTC', todayMinutes: 0, weekMinutes: 0, totalMinutes: 0,
                currentStreakDays: 0, longestStreakDays: 0, itemsCompleted: 0, last30Days: [],
            } ),
            'GET /me/enrollments': () => json( 200, [ DSA ] ),
            'GET /me/study-sessions': () => json( 200, { total: 0, items: [] } ),
        } );
        renderApp( '/app' );

        await userEvent.setup().click( await screen.findByRole( 'link', { name: 'Data Structures & Algorithms' } ) );

        expect( screen.getByTestId( 'location' ) ).toHaveTextContent( `/app/paths/${DSA.id}` );
        expect( await screen.findByRole( 'heading', { level: 1 } ) ).toHaveTextContent( 'Data Structures & Algorithms' );
    } );

    it( 'logs time on an item with the path, topic and item already chosen', async () => {
        const { calls } = api( {
            'GET /me/study-sessions': () => json( 200, { total: 0, items: [] } ),
            'GET /me/enrollments': () => json( 200, [ DSA ] ),
            'POST /me/study-sessions': () => json( 201, {} ),
        } );
        const user = userEvent.setup();

        renderApp( `/app/paths/${DSA.id}` );
        await screen.findByRole( 'heading', { level: 1 } );
        await user.click( within( item( 'Two Sum' ) ).getByRole( 'link', { name: 'Log time' } ) );

        const form = await screen.findByRole( 'form', { name: 'Log a study session' } );

        expect( await within( form ).findByLabelText( 'Learning path' ) ).toHaveValue( DSA.id );
        await waitFor( () => expect( within( form ).getByLabelText( 'Topic' ) ).toHaveValue( uuid( 1 ) ) );
        expect( within( form ).getByLabelText( 'Item (optional)' ) ).toHaveValue( TWO_SUM );

        await user.click( within( form ).getByRole( 'button', { name: 'Log session' } ) );
        await screen.findByText( 'Session logged.' );
        expect( calledWith( calls, 'POST', '/me/study-sessions' )[0]?.body ).toMatchObject( { topicId: uuid( 1 ), itemId: TWO_SUM } );
    } );
} );
