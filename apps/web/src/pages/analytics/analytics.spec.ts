import { daysAgo, doneShare, focusSummary, formatHours, isPeriod, labelledWeeks, periodLabel, toneOf, versusBefore } from './analytics.ts';

const TOTALS = {
    minutes: 1300,
    previousMinutes: 1110,
    sessions: 34,
    itemsDone: 18,
    itemsDoneTotal: 42,
    topicsCompleted: 9,
    topicsTotal: 21,
    toRevise: 6,
};

const TOPIC = {
    enrollmentId: 'e1',
    pathTitle: 'DSA',
    moduleTitle: 'Arrays',
    topicId: 't1',
    topicTitle: 'Sliding Window',
    completed: 1,
    total: 3,
    toRevise: 0,
    lastStudiedOn: null,
    next: [],
};

describe( 'analytics', () => {
    it( 'knows the periods', () => {
        expect( [ '30d', '90d', 'all' ].every( isPeriod ) ).toBe( true );
        expect( isPeriod( '7d' ) ).toBe( false );
        expect( isPeriod( null ) ).toBe( false );
        expect( [ periodLabel( '30d' ), periodLabel( '90d' ), periodLabel( 'all' ) ] ).toEqual( [ 'Last 30 days', 'Last 90 days', 'All time' ] );
    } );

    it( 'compares time studied with the period before', () => {
        expect( versusBefore( TOTALS, '30d' ) ).toBe( '+3h 10m vs the 30 days before' );
        expect( versusBefore( { ...TOTALS, previousMinutes: 1400 }, '90d' ) ).toBe( '−1h 40m vs the 90 days before' );
        expect( versusBefore( { ...TOTALS, previousMinutes: 1300 }, '30d' ) ).toBe( 'Same as the 30 days before' );
        expect( versusBefore( { ...TOTALS, previousMinutes: null }, 'all' ) ).toBe( 'All time' );
    } );

    it( 'labels about four weeks, always the current one', () => {
        expect( [ ...labelledWeeks( 12 ) ].sort( ( a, b ) => a - b ) ).toEqual( [ 0, 3, 6, 9, 11 ] );
        expect( [ ...labelledWeeks( 13 ) ].sort( ( a, b ) => a - b ) ).toEqual( [ 0, 4, 8, 12 ] );
        // One week before the last would touch it: skipped.
        expect( [ ...labelledWeeks( 14 ) ].sort( ( a, b ) => a - b ) ).toEqual( [ 0, 4, 8, 13 ] );
        expect( [ ...labelledWeeks( 2 ) ].sort( ( a, b ) => a - b ) ).toEqual( [ 0, 1 ] );
        expect( [ ...labelledWeeks( 1 ) ] ).toEqual( [ 0 ] );
    } );

    it( 'writes a window of hours', () => {
        expect( formatHours( { from: 18, to: 21 } ) ).toBe( '6–9 PM' );
        expect( formatHours( { from: 10, to: 13 } ) ).toBe( '10 AM–1 PM' );
        expect( formatHours( { from: 0, to: 3 } ) ).toBe( '12–3 AM' );
        expect( formatHours( { from: 21, to: 24 } ) ).toBe( '9 PM–12 AM' );
    } );

    it( 'says how long ago', () => {
        expect( daysAgo( '2026-10-19', '2026-10-19' ) ).toBe( 'today' );
        expect( daysAgo( '2026-10-20', '2026-10-19' ) ).toBe( 'today' );
        expect( daysAgo( '2026-10-18', '2026-10-19' ) ).toBe( 'yesterday' );
        expect( daysAgo( '2026-10-10', '2026-10-19' ) ).toBe( '9 days ago' );
        expect( daysAgo( '2026-09-29', '2026-10-19' ) ).toBe( '20 days ago' );
        expect( daysAgo( '2026-09-28', '2026-10-19' ) ).toBe( '3 weeks ago' );
    } );

    it( 'sums up a topic that needs focus', () => {
        expect( focusSummary( TOPIC, '2026-10-19' ) ).toBe( '1 of 3 done' );
        expect( focusSummary( { ...TOPIC, toRevise: 2, lastStudiedOn: '2026-10-10' }, '2026-10-19' ) )
            .toBe( '2 items to revise · last studied 9 days ago' );
        expect( focusSummary( { ...TOPIC, toRevise: 1 }, '2026-10-19' ) ).toBe( '1 item to revise' );
        expect( focusSummary( { ...TOPIC, completed: 0, total: 2 }, '2026-10-19' ) ).toBe( 'Not started · 2 required items' );
        expect( focusSummary( { ...TOPIC, completed: 0, total: 1 }, '2026-10-19' ) ).toBe( 'Not started · 1 required item' );
    } );

    it( 'colors a share, and counts items for revision as done', () => {
        expect( [ toneOf( 0 ), toneOf( 1 ), toneOf( 79 ), toneOf( 80 ) ] ).toEqual( [ 'danger', 'warning', 'warning', 'success' ] );
        expect( doneShare( { done: 42, revise: 6, inProgress: 5, notStarted: 22 } ) ).toBe( 64 );
        expect( doneShare( { done: 0, revise: 0, inProgress: 0, notStarted: 0 } ) ).toBe( 0 );
    } );
} );
