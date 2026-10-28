import type { ReadinessJson } from '@studylog/schemas';
import { EnrollmentStatus } from '@studylog/schemas/enums';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, loggedIn, mockApi, pending } from '../../test/api.ts';
import { enrollment, uuid } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';

// Tests run in UTC (see vitest.config.ts). "Now" is Monday Oct 19, 2026.
const NOW = new Date( '2026-10-19T09:00:00Z' );

const DSA = enrollment( 'Data Structures & Algorithms', EnrollmentStatus.Active, 20, 25, uuid( 201 ) );
const SYSTEM = enrollment( 'System Design Fundamentals', EnrollmentStatus.Paused, 5, 15, uuid( 202 ) );
const SPRINT = enrollment( 'Interview Sprint', EnrollmentStatus.Completed, 5, 5, uuid( 203 ) );
const OLD = enrollment( 'Old Path', EnrollmentStatus.Dropped, 0, 3, uuid( 204 ) );

const GOAL = {
    title: 'SDE interview',
    targetDate: '2026-11-30',
    enrollmentIds: [ DSA.id, SYSTEM.id, OLD.id ],
    updatedAt: '2026-10-01T00:00:00.000Z',
};

const READINESS: ReadinessJson = {
    goal: GOAL,
    readiness: {
        score: 71,
        label: 'Almost ready',
        weights: { coverage: 40, depth: 25, revision: 15, consistency: 20 },
        daysLeft: 42,
        pace: { itemsPerDay: 1.2, neededPerDay: 0.9, projectedDate: '2026-11-22', onTrack: true },
        categories: [
            {
                key: 'coverage',
                score: 62,
                checks: [
                    { label: 'Arrays & Hashing', done: true, detail: '9/9' },
                    { label: 'Trees', done: false, detail: '1/5' },
                ],
            },
            { key: 'depth', score: 45, checks: [ { label: 'Hard', done: false, detail: '1/6' } ] },
            { key: 'revision', score: 70, checks: [ { label: 'Nothing waiting more than 14 days', done: false, detail: null } ] },
            { key: 'consistency', score: 85, checks: [ { label: '12-day streak', done: true, detail: null } ] },
        ],
        nextSteps: [
            {
                kind: 'module',
                priority: 'high',
                title: 'Finish Trees: 4 required items left',
                detail: 'Next up: Validate Binary Search Tree',
                enrollmentId: DSA.id,
                topicId: uuid( 1 ),
                itemId: uuid( 11 ),
            },
            {
                kind: 'mock',
                priority: 'high',
                title: 'Do a mock interview',
                detail: 'Mock Interview: Arrays, in Interview Sprint',
                enrollmentId: SPRINT.id,
                topicId: uuid( 2 ),
                itemId: uuid( 12 ),
            },
            {
                kind: 'revise',
                priority: 'medium',
                title: 'Clear your 6 Revise items',
                detail: 'Oldest: Contains Duplicate, marked 16 days ago',
                enrollmentId: DSA.id,
                topicId: uuid( 3 ),
                itemId: uuid( 13 ),
            },
            {
                kind: 'resume',
                priority: 'medium',
                title: 'Resume System Design Fundamentals',
                detail: 'Paused · 10 items left',
                enrollmentId: SYSTEM.id,
                topicId: null,
                itemId: null,
            },
            {
                kind: 'hard',
                priority: 'low',
                title: 'Try a hard problem',
                detail: 'Minimum Window Substring · Sliding Window',
                enrollmentId: DSA.id,
                topicId: uuid( 4 ),
                itemId: uuid( 14 ),
            },
        ],
    },
};

const NO_GOAL: ReadinessJson = { goal: null, readiness: null };

type Handlers = Parameters<typeof mockApi>[0];

function api( readiness: ReadinessJson = READINESS, handlers: Handlers = {} ) {
    return mockApi( {
        ...loggedIn,
        'GET /me/readiness': () => json( 200, readiness ),
        'GET /me/enrollments': () => json( 200, [ DSA, SYSTEM, SPRINT, OLD ] ),
        ...handlers,
    } );
}

const category = ( name: string ) => screen.getByRole( 'region', { name } );
const step = ( title: string ) => screen.getByRole( 'heading', { level: 3, name: title } ).closest( 'li' )!;

describe( 'ReadinessPage', () => {
    beforeEach( () => {
        vi.useFakeTimers( { toFake: [ 'Date' ] } );
        vi.setSystemTime( NOW );
    } );

    afterEach( () => {
        vi.useRealTimers();
    } );

    it( 'shows the score, the goal and how it\'s going', async () => {
        const { calls } = api();

        renderApp( '/app/interview-ready' );

        expect( await screen.findByRole( 'img', { name: 'Readiness score: 71 of 100' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'heading', { level: 1, name: 'Interview ready' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'heading', { level: 2, name: 'SDE interview · Nov 30' } ) ).toBeInTheDocument();
        expect( screen.getByText( 'Almost ready' ) ).toBeInTheDocument();
        // Only paths still followed are named.
        expect( screen.getByText( /^Based on Data Structures & Algorithms and System Design Fundamentals\. You're strongest on consistency; work on depth/ ) )
            .toBeInTheDocument();
        const facts = screen.getByText( 'Time left' ).closest( 'dl' )!;

        expect( facts ).toHaveTextContent( 'Time left42 daysYour pace1.2 items a day · need 0.9At this paceDone by Nov 22' );
        expect( screen.getByText( 'How the score works: coverage 40% · depth 25% · revision 15% · consistency 20%. Only the paths in your goal count.' ) )
            .toBeInTheDocument();
        expect( screen.queryByText( 'Loading your readiness…' ) ).not.toBeInTheDocument();
        expect( calls.find( ( call ) => call.path === '/me/readiness' )?.query ).toBe( '?timeZone=UTC' );
    } );

    it( 'shows each category with its checks', async () => {
        api();
        renderApp( '/app/interview-ready' );
        await screen.findByRole( 'region', { name: 'Coverage' } );

        expect( category( 'Coverage' ) ).toHaveTextContent( 'What you\'ve finished in your goal\'s paths' );
        expect( category( 'Coverage' ) ).toHaveTextContent( 'Moderate62%' );
        expect( within( category( 'Coverage' ) ).getByRole( 'progressbar', { name: 'Coverage score' } ) ).toHaveAttribute( 'aria-valuenow', '62' );
        expect( within( category( 'Coverage' ) ).getAllByRole( 'listitem' ).map( ( check ) => check.textContent ) )
            .toEqual( [ 'Arrays & Hashing (done)9/9', 'Trees (not yet)1/5' ] );
        expect( category( 'Depth' ) ).toHaveTextContent( 'Weak45%' );
        expect( category( 'Revision' ) ).toHaveTextContent( 'Nothing waiting more than 14 days (not yet)' );
        expect( category( 'Consistency' ) ).toHaveTextContent( 'Strong85%' );
    } );

    it( 'lists the next steps, each with a way to do it', async () => {
        api();
        renderApp( '/app/interview-ready' );
        await screen.findByRole( 'region', { name: 'Your next steps' } );

        expect( step( 'Finish Trees: 4 required items left' ) ).toHaveTextContent( 'Next up: Validate Binary Search TreeHighOpen' );
        expect( within( step( 'Finish Trees: 4 required items left' ) ).getByRole( 'link' ) ).toHaveAttribute( 'href', `/app/paths/${DSA.id}?topic=${uuid( 1 )}` );
        expect( within( step( 'Do a mock interview' ) ).getByRole( 'link', { name: 'Log time: Do a mock interview' } ) )
            .toHaveAttribute( 'href', `/app/sessions?log&path=${SPRINT.id}&topic=${uuid( 2 )}&item=${uuid( 12 )}` );
        expect( within( step( 'Clear your 6 Revise items' ) ).getByRole( 'link', { name: 'Review: Clear your 6 Revise items' } ) ).toBeInTheDocument();
        expect( step( 'Clear your 6 Revise items' ) ).toHaveTextContent( 'Medium' );
        expect( within( step( 'Resume System Design Fundamentals' ) ).getByRole( 'button', { name: 'Resume' } ) ).toBeInTheDocument();
        expect( step( 'Try a hard problem' ) ).toHaveTextContent( 'Low' );
    } );

    it( 'resumes a paused path, then loads the readiness again', async () => {
        const { calls } = api( READINESS, { [`PATCH /me/enrollments/${SYSTEM.id}`]: () => json( 200, { ...SYSTEM, status: EnrollmentStatus.Active } ) } );

        renderApp( '/app/interview-ready' );
        await userEvent.setup().click( await screen.findByRole( 'button', { name: 'Resume' } ) );

        await waitFor( () => expect( calls.filter( ( call ) => call.path === '/me/readiness' ) ).toHaveLength( 2 ) );
        expect( calls.find( ( call ) => call.method === 'PATCH' )?.body ).toEqual( { status: 'active' } );
    } );

    it( 'says when a path couldn\'t be resumed', async () => {
        let answer: () => Response = () => json( 500, {} );

        api( READINESS, { [`PATCH /me/enrollments/${SYSTEM.id}`]: () => answer() } );
        renderApp( '/app/interview-ready' );
        const user = userEvent.setup();

        await user.click( await screen.findByRole( 'button', { name: 'Resume' } ) );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Couldn\'t resume this path. Please try again.' );

        // While it tries again.
        answer = () => new Promise<Response>( () => undefined ) as unknown as Response;
        await user.click( screen.getByRole( 'button', { name: 'Resume' } ) );
        expect( await screen.findByRole( 'button', { name: 'Resuming…' } ) ).toBeDisabled();
        expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();
    } );

    it( 'says when there is nothing left to do', async () => {
        api( { ...READINESS, readiness: { ...READINESS.readiness!, nextSteps: [] } } );
        renderApp( '/app/interview-ready' );

        expect( await screen.findByText( 'Nothing to do right now: you\'ve covered everything in your goal.' ) ).toBeInTheDocument();
    } );

    it( 'shows a score of 0 as an empty ring', async () => {
        api( { ...READINESS, readiness: { ...READINESS.readiness!, score: 0, label: 'Just started' } } );
        renderApp( '/app/interview-ready' );

        const ring = await screen.findByRole( 'img', { name: 'Readiness score: 0 of 100' } );

        expect( ring.querySelectorAll( 'circle' ) ).toHaveLength( 1 );
        expect( screen.getByText( 'Just started' ) ).toBeInTheDocument();
    } );

    it( 'asks for a goal, and sets one', async () => {
        const { calls } = api( NO_GOAL, { 'PUT /me/interview-goal': () => json( 200, GOAL ) } );
        const user = userEvent.setup();

        renderApp( '/app/interview-ready' );

        expect( await screen.findByRole( 'heading', { level: 2, name: 'Set an interview goal' } ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'button', { name: 'Edit goal' } ) ).not.toBeInTheDocument();
        await user.click( screen.getByRole( 'button', { name: 'Set a goal' } ) );

        const dialog = screen.getByRole( 'dialog', { name: 'Your interview goal' } );

        expect( within( dialog ).getByRole( 'textbox', { name: 'What are you preparing for?' } ) ).toHaveFocus();
        expect( within( dialog ).getByLabelText( 'Date' ) ).toHaveAttribute( 'min', '2026-10-19' );
        // Dropped paths aren't offered.
        expect( within( dialog ).getAllByRole( 'checkbox' ).map( ( box ) => box.closest( 'label' )?.textContent ) )
            .toEqual( [ 'Data Structures & Algorithms25 items', 'System Design Fundamentals15 items', 'Interview Sprint5 items' ] );
        expect( dialog ).toHaveTextContent( 'No paths chosen' );

        // Everything missing.
        await user.click( within( dialog ).getByRole( 'button', { name: 'Save goal' } ) );
        expect( dialog ).toHaveTextContent( 'Enter what you\'re preparing for.' );
        expect( dialog ).toHaveTextContent( 'Choose a date.' );
        expect( dialog ).toHaveTextContent( 'Choose at least one path.' );
        expect( within( dialog ).getByRole( 'textbox', { name: 'What are you preparing for?' } ) ).toHaveFocus();

        await user.type( within( dialog ).getByRole( 'textbox', { name: 'What are you preparing for?' } ), '  SDE interview ' );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Save goal' } ) );
        expect( within( dialog ).getByLabelText( 'Date' ) ).toHaveFocus();

        await user.type( within( dialog ).getByLabelText( 'Date' ), '2026-11-30' );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Save goal' } ) );
        expect( dialog.querySelector( '#goal-paths' ) ).toHaveFocus();
        expect( within( dialog ).getByRole( 'group', { name: 'Paths that count' } ) ).toHaveAccessibleDescription( 'Choose at least one path.' );

        await user.click( within( dialog ).getByRole( 'checkbox', { name: /Data Structures/ } ) );
        await user.click( within( dialog ).getByRole( 'checkbox', { name: /Interview Sprint/ } ) );
        expect( dialog ).toHaveTextContent( '30 items' );
        await user.click( within( dialog ).getByRole( 'checkbox', { name: /Interview Sprint/ } ) );
        expect( dialog ).toHaveTextContent( '25 items' );
        expect( within( dialog ).getByRole( 'group', { name: 'Paths that count' } ) ).toHaveAccessibleDescription( 'Choose at least one path.' );

        await user.click( within( dialog ).getByRole( 'button', { name: 'Save goal' } ) );

        await waitFor( () => expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument() );
        expect( calls.find( ( call ) => call.method === 'PUT' )?.body ).toEqual( {
            title: 'SDE interview',
            targetDate: '2026-11-30',
            enrollmentIds: [ DSA.id ],
        } );
        expect( calls.filter( ( call ) => call.path === '/me/readiness' ) ).toHaveLength( 2 );
    } );

    it( 'says a date in the past can\'t be chosen', async () => {
        api( NO_GOAL, { 'GET /me/enrollments': () => json( 200, [ enrollment( 'Tiny Path', EnrollmentStatus.Active, 0, 1, uuid( 205 ) ) ] ) } );
        const user = userEvent.setup();

        renderApp( '/app/interview-ready' );
        await user.click( await screen.findByRole( 'button', { name: 'Set a goal' } ) );
        await user.type( screen.getByLabelText( 'Date' ), '2026-10-18' );
        await user.click( screen.getByRole( 'button', { name: 'Save goal' } ) );

        expect( screen.getByRole( 'dialog' ) ).toHaveTextContent( 'Choose today or a later date.' );
        expect( screen.getByRole( 'checkbox', { name: /Tiny Path/ } ) ).toBeInTheDocument();
        await user.click( screen.getByRole( 'checkbox', { name: /Tiny Path/ } ) );
        expect( screen.getByRole( 'dialog' ) ).toHaveTextContent( '1 item' );
    } );

    it( 'asks to follow a path first when there are none', async () => {
        api( NO_GOAL, { 'GET /me/enrollments': () => json( 200, [ OLD ] ) } );
        renderApp( '/app/interview-ready' );

        expect( await screen.findByText( 'First follow a learning path from Browse paths.' ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'button', { name: 'Set a goal' } ) ).not.toBeInTheDocument();
    } );

    it( 'edits the goal, starting from what it is now', async () => {
        const { calls } = api( READINESS, { 'PUT /me/interview-goal': () => json( 200, GOAL ) } );
        const user = userEvent.setup();

        renderApp( '/app/interview-ready' );
        await user.click( await screen.findByRole( 'button', { name: 'Edit goal' } ) );

        const dialog = screen.getByRole( 'dialog', { name: 'Your interview goal' } );

        expect( within( dialog ).getByRole( 'textbox', { name: 'What are you preparing for?' } ) ).toHaveValue( 'SDE interview' );
        expect( within( dialog ).getByLabelText( 'Date' ) ).toHaveValue( '2026-11-30' );
        expect( within( dialog ).getAllByRole( 'checkbox' ).map( ( box ) => ( box as HTMLInputElement ).checked ) ).toEqual( [ true, true, false ] );
        expect( dialog ).toHaveTextContent( '40 items' );

        await user.click( within( dialog ).getByRole( 'button', { name: 'Save goal' } ) );
        await waitFor( () => expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument() );
        // The dropped path falls out.
        expect( calls.find( ( call ) => call.method === 'PUT' )?.body ).toMatchObject( { enrollmentIds: [ DSA.id, SYSTEM.id ] } );
    } );

    it( 'closes the dialog without saving', async () => {
        const { calls } = api();
        const user = userEvent.setup();

        renderApp( '/app/interview-ready' );
        await user.click( await screen.findByRole( 'button', { name: 'Edit goal' } ) );
        await user.click( screen.getByRole( 'button', { name: 'Cancel' } ) );

        expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
        expect( calls.some( ( call ) => call.method === 'PUT' ) ).toBe( false );
    } );

    it( 'says why the goal wasn\'t saved', async () => {
        let answer = () => json( 400, { statusCode: 400, message: 'Bad Request' } );

        api( READINESS, { 'PUT /me/interview-goal': () => answer() } );
        const user = userEvent.setup();

        renderApp( '/app/interview-ready' );
        await user.click( await screen.findByRole( 'button', { name: 'Edit goal' } ) );
        const save = screen.getByRole( 'button', { name: 'Save goal' } );

        await user.click( save );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Check the date and paths' );
        expect( save ).toBeEnabled();

        answer = () => json( 500, {} );
        await user.click( save );
        await waitFor( () => expect( screen.getByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so the goal wasn\'t saved.' ) );

        answer = () => {
            throw new TypeError( 'Failed to fetch' );
        };
        await user.click( save );
        await waitFor( () => expect( screen.getByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach Gradiaqo right now.' ) );

        answer = () => new Promise<Response>( () => undefined ) as unknown as Response;
        await user.click( save );
        expect( await screen.findByRole( 'button', { name: 'Saving…' } ) ).toBeDisabled();
    } );

    it( 'says when loading failed, and tries again', async () => {
        let fail = true;

        api( READINESS, {
            'GET /me/readiness': () => {
                const failed = fail;

                fail = false;

                return failed ? json( 500, {} ) : json( 200, READINESS );
            },
        } );
        renderApp( '/app/interview-ready' );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong while loading your readiness. Please try again.' );
        await userEvent.setup().click( screen.getByRole( 'button', { name: 'Try again' } ) );
        expect( await screen.findByRole( 'img', { name: /Readiness score/ } ) ).toBeInTheDocument();
    } );

    it( 'says when Gradiaqo can\'t be reached, while loading first', async () => {
        mockApi( { ...loggedIn, 'GET /me/readiness': pending, 'GET /me/enrollments': pending } );
        const loading = renderApp( '/app/interview-ready' );

        expect( await screen.findByText( 'Loading your readiness…' ) ).toBeInTheDocument();
        loading.unmount();

        api( READINESS, { 'GET /me/enrollments': () => Promise.reject( new TypeError( 'Failed to fetch' ) ) } );
        renderApp( '/app/interview-ready' );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach Gradiaqo right now.' );
    } );
} );
