import { EnrollmentStatus } from '@studylog/schemas/enums';

import { enrollment, uuid } from '../../test/fixtures.ts';
import { firstInvalid, validateGoal } from './goal-form.ts';
import type { NextStep, Readiness } from './readiness.ts';
import { factsOf, goalPathTitles, stepLink, strengthOf, summaryOf, weightsOf } from './readiness.ts';

const READINESS: Readiness = {
    score: 71,
    label: 'Almost ready',
    weights: { coverage: 40, depth: 25, revision: 15, consistency: 20 },
    daysLeft: 42,
    pace: { itemsPerDay: 1.2, neededPerDay: 0.9, projectedDate: '2026-11-22', onTrack: true },
    categories: [
        { key: 'coverage', score: 62, checks: [] },
        { key: 'depth', score: 55, checks: [] },
        { key: 'revision', score: 70, checks: [] },
        { key: 'consistency', score: 85, checks: [] },
    ],
    nextSteps: [],
};

const STEP: NextStep = {
    kind: 'module',
    priority: 'high',
    title: 'Finish Trees',
    detail: 'Next up: Validate BST',
    enrollmentId: 'e1',
    topicId: 't1',
    itemId: 'i1',
};

describe( 'readiness', () => {
    it( 'puts a category score in words', () => {
        expect( strengthOf( 85 ) ).toEqual( { label: 'Strong', tone: 'success' } );
        expect( strengthOf( 80 ) ).toEqual( { label: 'Strong', tone: 'success' } );
        expect( strengthOf( 50 ) ).toEqual( { label: 'Moderate', tone: 'warning' } );
        expect( strengthOf( 49 ) ).toEqual( { label: 'Weak', tone: 'danger' } );
    } );

    it( 'sums up the goal: its paths, the strongest and weakest categories', () => {
        expect( summaryOf( READINESS, [ 'DSA', 'System Design' ] ) )
            .toBe( 'Based on DSA and System Design. You\'re strongest on consistency; work on depth to be ready in time.' );
        expect( summaryOf( READINESS, [ 'A', 'B', 'C' ] ) ).toMatch( /^Based on A, B and C\./ );
        expect( summaryOf( READINESS, [ 'DSA' ] ) ).toMatch( /^Based on DSA\./ );
        expect( summaryOf( READINESS, [] ) ).toMatch( /^None of the goal's paths are on your list any more\./ );
        // All the same: nothing stands out.
        expect( summaryOf( { ...READINESS, categories: READINESS.categories.map( ( category ) => ( { ...category, score: 50 } ) ) }, [ 'DSA' ] ) )
            .toBe( 'Based on DSA.' );
        expect( summaryOf( { ...READINESS, categories: [] }, [ 'DSA' ] ) ).toBe( 'Based on DSA.' );
    } );

    it( 'names the goal\'s paths that are still followed, in order', () => {
        const a = enrollment( 'A', EnrollmentStatus.Active, 0, 1, uuid( 1 ) );
        const b = enrollment( 'B', EnrollmentStatus.Active, 0, 1, uuid( 2 ) );

        expect( goalPathTitles( [ uuid( 2 ), uuid( 3 ), uuid( 1 ) ], [ a, b ] ) ).toEqual( [ 'B', 'A' ] );
    } );

    it( 'states time left, pace and projection', () => {
        expect( factsOf( READINESS ) ).toEqual( [
            { label: 'Time left', value: '42 days', icon: 'calendar' },
            { label: 'Your pace', value: '1.2 items a day · need 0.9', icon: 'trending-up', tone: 'success' },
            { label: 'At this pace', value: 'Done by Nov 22', icon: 'check-circle', tone: 'success' },
        ] );

        const behind = factsOf( {
            ...READINESS,
            daysLeft: 1,
            pace: { itemsPerDay: 1, neededPerDay: 3, projectedDate: '2026-12-01', onTrack: false },
        } );

        expect( behind.map( ( fact ) => [ fact.value, fact.tone ] ) ).toEqual( [
            [ '1 day', undefined ],
            [ '1 item a day · need 3', 'warning' ],
            [ 'Done by Dec 1', 'warning' ],
        ] );
        expect( behind[2]?.icon ).toBe( 'clock' );

        const done = factsOf( {
            ...READINESS,
            daysLeft: 0,
            pace: { itemsPerDay: 0, neededPerDay: null, projectedDate: null, onTrack: true },
        } );

        expect( done.map( ( fact ) => fact.value ) ).toEqual( [ 'The day is here', '0 items a day', 'Everything done' ] );

        const stalled = factsOf( {
            ...READINESS,
            pace: { itemsPerDay: 0, neededPerDay: 0.5, projectedDate: null, onTrack: false },
        } );

        expect( stalled[2] ).toEqual( { label: 'At this pace', value: 'No recent progress', icon: 'clock', tone: 'warning' } );
    } );

    it( 'links each step to where it can be done', () => {
        expect( stepLink( STEP ) ).toBe( '/app/paths/e1?topic=t1' );
        expect( stepLink( { ...STEP, kind: 'mock' } ) ).toBe( '/app/sessions?log&path=e1&topic=t1&item=i1' );
        expect( stepLink( { ...STEP, kind: 'mock', itemId: null } ) ).toBe( '/app/paths/e1?topic=t1' );
        expect( stepLink( { ...STEP, kind: 'mock', topicId: null } ) ).toBe( '/app/paths/e1' );
        expect( stepLink( { ...STEP, kind: 'resume', topicId: null, itemId: null } ) ).toBe( '/app/paths/e1' );
    } );

    it( 'lists the weights', () => {
        expect( weightsOf( READINESS.weights ) ).toBe( 'coverage 40% · depth 25% · revision 15% · consistency 20%' );
    } );
} );

describe( 'goal form', () => {
    it( 'needs a name, a date from today and a path', () => {
        expect( validateGoal( 'SDE interview', '2026-11-30', 2, '2026-10-19' ) ).toEqual( {} );
        expect( validateGoal( 'SDE', '2026-10-19', 1, '2026-10-19' ) ).toEqual( {} );
        expect( validateGoal( '  ', '', 0, '2026-10-19' ) ).toEqual( {
            title: 'Enter what you\'re preparing for.',
            date: 'Choose a date.',
            paths: 'Choose at least one path.',
        } );
        expect( validateGoal( 'SDE', '2026-10-18', 1, '2026-10-19' ) ).toEqual( { date: 'Choose today or a later date.' } );
    } );

    it( 'finds the first field to fix', () => {
        expect( firstInvalid( { title: 'x', date: 'x', paths: 'x' } ) ).toBe( 'goal-title' );
        expect( firstInvalid( { date: 'x', paths: 'x' } ) ).toBe( 'goal-date' );
        expect( firstInvalid( { paths: 'x' } ) ).toBe( 'goal-paths' );
        expect( firstInvalid( {} ) ).toBeUndefined();
    } );
} );
