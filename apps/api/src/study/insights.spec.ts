import type { EnrollmentDetail, InterviewGoal } from '@studylog/schemas';
import { Difficulty, EnrollmentStatus, ItemType, ProgressStatus } from '@studylog/schemas/enums';

import type { ProgressRow, SessionRow } from './insights.js';
import { computeAnalytics, computeReadiness, READINESS_WEIGHTS } from './insights.js';

// Monday, Oct 19 2026, noon UTC.
const NOW = new Date( '2026-10-19T12:00:00Z' );
const { Done, Revise, InProgress, NotStarted } = ProgressStatus;
const { Easy, Medium, Hard } = Difficulty;

interface ItemSpec {
    id: string;
    title?: string;
    type?: ItemType;
    difficulty?: Difficulty;
    optional?: boolean;
    progress?: ProgressStatus;
}
interface TopicSpec { id: string; title?: string; items: ItemSpec[] }
interface ModuleSpec { id: string; title?: string; topics: TopicSpec[] }

const FINISHED = [ Done, Revise ];

/** Required items done or marked for revision, like the API counts them. */
function count( items: ItemSpec[] ) {
    const required = items.filter( ( item ) => !item.optional );

    const completed = required.filter( ( item ) => FINISHED.includes( item.progress ?? NotStarted ) ).length;

    return { completed, total: required.length };
}

/** An enrollment tree with progress counted from its items. */
function tree(
    id: string,
    pathId: string,
    title: string,
    modules: ModuleSpec[],
    status = EnrollmentStatus.Active,
): EnrollmentDetail {
    const all = modules.flatMap( ( module ) => module.topics.flatMap( ( topic ) => topic.items ) );

    return {
        id,
        status,
        learningPath: { id: pathId, title },
        progress: count( all ),
        modules: modules.map( ( module ) => ( {
            id: module.id,
            title: module.title ?? module.id,
            progress: count( module.topics.flatMap( ( topic ) => topic.items ) ),
            topics: module.topics.map( ( topic ) => ( {
                id: topic.id,
                title: topic.title ?? topic.id,
                progress: count( topic.items ),
                items: topic.items.map( ( item ) => ( {
                    id: item.id,
                    title: item.title ?? item.id,
                    type: item.type ?? ItemType.Problem,
                    difficulty: item.difficulty ?? null,
                    isOptional: item.optional ?? false,
                    progress: item.progress ?? NotStarted,
                } ) ),
            } ) ),
        } ) ),
    } as unknown as EnrollmentDetail;
}

function session(
    at: string,
    minutes: number,
    topicId: string | null,
    learningPathId: string | null,
    itemId: string | null = null,
): SessionRow {
    return { startedAt: new Date( at ), durationMinutes: minutes, topicId, itemId, learningPathId };
}
const progress = ( itemId: string, status: ProgressStatus, completedAt: string | null, updatedAt = '2026-10-01T00:00:00Z' ): ProgressRow => (
    { itemId, status, completedAt: completedAt && new Date( completedAt ), updatedAt: new Date( updatedAt ) }
);

describe( 'computeAnalytics', () => {
    // Path A: t1 (2 of 3 required done, one to revise), t2 (done), t3 (empty). Path B: t4, sharing i1 as optional.
    const A = tree( 'eA', 'pA', 'Data Structures', [ { id: 'm1', title: 'Arrays', topics: [
        { id: 't1', title: 'Hashing', items: [
            { id: 'i1', difficulty: Easy, progress: Done },
            { id: 'i2', difficulty: Medium, progress: Revise },
            { id: 'i3', difficulty: Hard, progress: InProgress },
            { id: 'i4', optional: true },
        ] },
        { id: 't2', items: [ { id: 'i5', difficulty: Easy, progress: Done } ] },
        { id: 't3', items: [] },
    ] } ] );
    const B = tree( 'eB', 'pB', 'System Design', [ { id: 'm2', topics: [
        { id: 't4', title: 'Caching', items: [ { id: 'i1', optional: true, difficulty: Easy, progress: Done }, { id: 'i6' } ] },
    ] } ] );
    const SESSIONS = [
        session( '2026-10-19T08:00:00Z', 30, 't1', 'pA' ), // Monday
        session( '2026-10-01T19:00:00Z', 60, 't4', 'pB' ), // Thursday evening
        session( '2026-09-10T10:00:00Z', 45, 't1', 'pA' ), // the 30 days before
        session( '2026-07-01T10:00:00Z', 20, null, null ), // topic deleted since
    ];
    const PROGRESS = [
        progress( 'i1', Done, '2026-10-05T00:00:00Z' ),
        progress( 'i2', Revise, '2026-08-01T00:00:00Z' ),
        progress( 'i5', Done, null ),
        progress( 'i3', InProgress, null ),
    ];
    const run = ( overrides: Partial<Parameters<typeof computeAnalytics>[0]> = {} ) => computeAnalytics( {
        period: '30d', timeZone: 'UTC', now: NOW, trees: [ A, B ], sessions: SESSIONS, progress: PROGRESS, scoped: false, ...overrides,
    } );

    it( 'sums the last 30 days, compares them with the 30 before, and counts items and topics once', () => {
        const analytics = run();

        expect( analytics ).toMatchObject( { period: '30d', timeZone: 'UTC', from: '2026-09-20', to: '2026-10-19' } );
        expect( analytics.totals ).toEqual( {
            minutes: 90,
            previousMinutes: 45,
            sessions: 2,
            itemsDone: 1,
            itemsDoneTotal: 3,
            topicsCompleted: 1,
            topicsTotal: 3,
            toRevise: 1,
        } );
        expect( analytics.byPath ).toEqual( [
            { enrollmentId: 'eB', title: 'System Design', minutes: 60 },
            { enrollmentId: 'eA', title: 'Data Structures', minutes: 30 },
        ] );
        expect( analytics.itemStatus ).toEqual( { done: 2, revise: 1, inProgress: 1, notStarted: 2 } );
        expect( analytics.difficulty ).toEqual( [
            { difficulty: Easy, done: 2, total: 2 },
            { difficulty: Medium, done: 1, total: 1 },
            { difficulty: Hard, done: 0, total: 1 },
        ] );
        expect( analytics.habits ).toEqual( {
            sessions: 2, averageSessionMinutes: 45, bestWeekday: 'Thursday', mostActiveHours: { from: 18, to: 21 },
        } );
    } );

    it( 'shows 12 weeks, the last one this week', () => {
        const { weeks } = run();

        expect( weeks ).toHaveLength( 12 );
        expect( weeks.at( -1 ) ).toEqual( { weekStart: '2026-10-19', minutes: 30 } );
        expect( weeks.find( ( week ) => week.weekStart === '2026-09-28' ) ).toEqual( { weekStart: '2026-09-28', minutes: 60 } );
        expect( weeks[0].weekStart ).toBe( '2026-08-03' );
    } );

    it( 'puts topics with items to revise first, then the least done, with what to do next', () => {
        expect( run().focus ).toEqual( [
            {
                enrollmentId: 'eA', pathTitle: 'Data Structures', moduleTitle: 'Arrays', topicId: 't1', topicTitle: 'Hashing',
                completed: 2, total: 3, toRevise: 1, lastStudiedOn: '2026-10-19',
                // Required items first, then optional ones.
                next: [ { id: 'i3', title: 'i3' }, { id: 'i4', title: 'i4' } ],
            },
            {
                enrollmentId: 'eB', pathTitle: 'System Design', moduleTitle: 'm2', topicId: 't4', topicTitle: 'Caching',
                completed: 0, total: 1, toRevise: 0, lastStudiedOn: '2026-10-01', next: [ { id: 'i6', title: 'i6' } ],
            },
        ] );
    } );

    it( 'for one path, counts only its sessions, over 90 days and 13 weeks', () => {
        const analytics = run( { period: '90d', trees: [ A ], scoped: true } );

        expect( analytics.from ).toBe( '2026-07-22' );
        expect( analytics.totals ).toMatchObject( { minutes: 75, previousMinutes: 0, sessions: 2 } );
        expect( analytics.byPath ).toEqual( [ { enrollmentId: 'eA', title: 'Data Structures', minutes: 75 } ] );
        expect( analytics.weeks ).toHaveLength( 13 );
    } );

    it( 'for all time, has no start or comparison, counts every finished item, and shows weeks since the first session', () => {
        const analytics = run( { period: 'all' } );

        expect( analytics.from ).toBeNull();
        expect( analytics.totals ).toMatchObject( { minutes: 155, previousMinutes: null, itemsDone: 2, sessions: 4 } );
        // From the week of Jun 29 to the week of Oct 19.
        expect( analytics.weeks ).toHaveLength( 17 );
        expect( analytics.weeks[0] ).toEqual( { weekStart: '2026-06-29', minutes: 20 } );
    } );

    it( 'for all time, shows at least 12 weeks and at most 52', () => {
        expect( run( { period: 'all', sessions: [] } ).weeks ).toHaveLength( 12 );
        const old = [ session( '2024-01-10T10:00:00Z', 10, null, null ), session( '2025-06-10T10:00:00Z', 10, null, null ) ];

        expect( run( { period: 'all', sessions: old } ).weeks ).toHaveLength( 52 );
    } );

    it( 'without sessions, has no habits; ties in focus go to the topic studied longest ago', () => {
        const C = tree( 'eC', 'pC', 'Graphs', [ { id: 'm3', topics: [
            { id: 'ta', items: [ { id: 'x1' } ] },
            { id: 'tb', items: [ { id: 'x2' } ] },
            { id: 'tc', items: [ { id: 'x3' } ] },
            { id: 'td', items: [ { id: 'x4' } ] },
        ] } ] );
        const analytics = run( { trees: [ C ], sessions: [ session( '2026-01-05T10:00:00Z', 10, 'tb', 'pC' ), session( '2025-12-01T10:00:00Z', 10, 'tc', 'pC' ) ] } );

        expect( analytics.habits ).toEqual( {
            sessions: 0, averageSessionMinutes: 0, bestWeekday: null, mostActiveHours: null,
        } );
        expect( analytics.byPath ).toEqual( [] );
        // Never studied first (in the user's order), then the longest ago.
        expect( analytics.focus.map( ( topic ) => topic.topicId ) ).toEqual( [ 'ta', 'td', 'tc', 'tb' ] );
    } );

    it( 'counts days in the user\'s time zone', () => {
        // 20:00 UTC on Sunday is already Monday in Kolkata.
        const analytics = run( { timeZone: 'Asia/Kolkata', sessions: [ session( '2026-10-18T20:00:00Z', 40, 't1', 'pA' ) ] } );

        expect( analytics.habits ).toMatchObject( { bestWeekday: 'Monday', mostActiveHours: { from: 0, to: 3 } } );
    } );
} );

describe( 'computeReadiness', () => {
    const goal = ( targetDate: string, enrollmentIds = [ 'eA' ] ): InterviewGoal => (
        { title: 'SDE interview', targetDate, enrollmentIds, updatedAt: NOW }
    );
    const run = ( input: Partial<Parameters<typeof computeReadiness>[0]> & Pick<Parameters<typeof computeReadiness>[0], 'trees'> ) =>
        computeReadiness( { goal: goal( '2026-11-30' ), timeZone: 'UTC', now: NOW, sessions: [], progress: [], ...input } ).readiness!;

    // Arrays: 3 of 4 required done (one to revise, waiting since Oct 1). Trees: 2 of 3, a mock interview to do.
    const DSA = tree( 'eA', 'pA', 'DSA', [
        { id: 'm1', title: 'Arrays', topics: [ { id: 't1', title: 'Hashing', items: [
            { id: 'e1', difficulty: Easy, progress: Done },
            { id: 'e2', difficulty: Easy, progress: Done },
            { id: 'md1', title: 'Group Anagrams', difficulty: Medium, progress: Revise },
            { id: 'h1', title: 'Minimum Window', difficulty: Hard },
            { id: 'o1', optional: true },
        ] } ] },
        { id: 'm2', title: 'Trees', topics: [ { id: 't2', title: 'BST', items: [
            { id: 'md2', difficulty: Medium, progress: Done },
            { id: 'h2', difficulty: Hard, progress: Done },
            { id: 'mock', title: 'Mock Interview: Arrays', type: ItemType.Exercise },
        ] } ] },
    ] );
    const studied = [ '2026-10-19', '2026-10-18', '2026-10-17', '2026-10-10', '2026-10-08' ]
        .map( ( day ) => session( `${day}T09:00:00Z`, 30, 't1', 'pA' ) );

    it( 'scores coverage, depth, revision and consistency, with checks, pace and next steps', () => {
        const readiness = run( {
            trees: [ DSA ],
            sessions: [ ...studied, session( '2026-10-05T09:00:00Z', 45, 't2', 'pA', 'mock' ), session( '2026-10-19T10:00:00Z', 10, 't2', 'pA', 'md2' ) ],
            progress: [
                progress( 'e1', Done, '2026-10-15T00:00:00Z' ),
                progress( 'e2', Done, '2026-09-01T00:00:00Z' ),
                progress( 'md1', Revise, '2026-10-10T00:00:00Z', '2026-10-01T00:00:00Z' ),
                progress( 'md2', Done, '2026-10-12T00:00:00Z' ),
                progress( 'h2', Done, '2026-10-18T00:00:00Z' ),
            ],
        } );

        expect( readiness.categories ).toEqual( [
            { key: 'coverage', score: 71, checks: [
                { label: 'Arrays', done: false, detail: '3/4' },
                { label: 'Trees', done: false, detail: '2/3' },
            ] },
            { key: 'depth', score: 80, checks: [
                { label: 'Easy', done: true, detail: '2/2' },
                { label: 'Medium', done: true, detail: '2/2' },
                { label: 'Hard', done: false, detail: '1/2' },
                { label: 'A hard problem in every module', done: false, detail: '1/2' },
            ] },
            { key: 'revision', score: 70, checks: [
                { label: 'Nothing left to revise', done: false, detail: '1 marked Revise' },
                { label: 'Nothing waiting more than 14 days', done: false, detail: 'oldest 18d' },
            ] },
            // 5 days in the last 14 (30 of 60 points) and a 3-day streak (17 of 40).
            { key: 'consistency', score: 47, checks: [
                { label: '3-day streak', done: true, detail: null },
                { label: 'Studied on 10 of the last 14 days', done: false, detail: '5/14' },
                { label: 'A mock interview in the last 7 days', done: false, detail: null },
            ] },
        ] );
        // (71×40 + 80×25 + 70×15 + 47×20) / 100
        expect( readiness ).toMatchObject( { score: 68, label: 'Almost ready', daysLeft: 42, weights: READINESS_WEIGHTS } );
        // 4 required items finished in the last 14 days; 2 left over 42 days.
        expect( readiness.pace ).toEqual( { itemsPerDay: 0.3, neededPerDay: 0, projectedDate: '2026-10-26', onTrack: true } );
        expect( readiness.nextSteps ).toEqual( [
            { kind: 'module', priority: 'high', title: 'Finish Trees: 1 required item left', detail: 'Next up: Mock Interview: Arrays', enrollmentId: 'eA', topicId: 't2', itemId: 'mock' },
            { kind: 'mock', priority: 'high', title: 'Do a mock interview', detail: 'Mock Interview: Arrays, in DSA', enrollmentId: 'eA', topicId: 't2', itemId: 'mock' },
            { kind: 'revise', priority: 'medium', title: 'Clear your 1 Revise item', detail: 'Oldest: Group Anagrams, marked 18 days ago', enrollmentId: 'eA', topicId: 't1', itemId: 'md1' },
            { kind: 'hard', priority: 'low', title: 'Try a hard problem', detail: 'Minimum Window · Hashing', enrollmentId: 'eA', topicId: 't1', itemId: 'h1' },
        ] );
    } );

    it( 'is "Ready" when everything is done, studied daily, with a recent mock interview', () => {
        const done = tree( 'eA', 'pA', 'DSA', [ { id: 'm1', topics: [ { id: 't1', items: [
            { id: 'h1', difficulty: Hard, progress: Done },
            { id: 'h2', difficulty: Hard, progress: Done },
            { id: 'mock', title: 'Mock interview', type: ItemType.Exercise, progress: Done },
        ] } ] } ] );
        const daily = Array.from( { length: 12 }, ( _, i ) => session( `2026-10-${String( 19 - i ).padStart( 2, '0' )}T09:00:00Z`, 30, 't1', 'pA' ) );
        const readiness = run( { trees: [ done ], sessions: [ ...daily, session( '2026-10-15T09:00:00Z', 60, 't1', 'pA', 'mock' ) ] } );

        expect( readiness ).toMatchObject( { score: 100, label: 'Ready' } );
        expect( readiness.categories.map( ( category ) => category.score ) ).toEqual( [ 100, 100, 100, 100 ] );
        expect( readiness.categories[1].checks.at( -1 ) ).toEqual( { label: 'A hard problem in every module', done: true, detail: '1/1' } );
        expect( readiness.pace ).toEqual( { itemsPerDay: 0, neededPerDay: 0, projectedDate: null, onTrack: true } );
        expect( readiness.nextSteps ).toEqual( [] );
    } );

    it( 'is "Getting there" partway, and counts an item to revise without a date as waiting since today', () => {
        const partway = tree( 'eA', 'pA', 'DSA', [ { id: 'm1', topics: [ { id: 't1', items: [
            { id: 'a', progress: Done },
            { id: 'b', progress: Revise },
            { id: 'c' },
        ] } ] } ] );
        const readiness = run( { trees: [ partway ], progress: [ progress( 'a', Done, null ) ] } );

        // No difficulties: depth follows coverage (67). (67×40 + 67×25 + 90×15 + 0×20) / 100
        expect( readiness ).toMatchObject( { score: 57, label: 'Getting there' } );
        expect( readiness.categories[1] ).toEqual( { key: 'depth', score: 67, checks: [] } );
        expect( readiness.categories[2].checks[1] ).toEqual( { label: 'Nothing waiting more than 14 days', done: true, detail: 'oldest 0d' } );
        expect( readiness.categories[3].checks ).toEqual( [
            { label: '0-day streak', done: false, detail: null },
            { label: 'Studied on 10 of the last 14 days', done: false, detail: '0/14' },
        ] );
    } );

    it( 'is "Just started" with nothing done: no pace, no time left after the date, and asks to resume paused paths', () => {
        const fresh = tree( 'eA', 'pA', 'DSA', [
            { id: 'm1', title: 'Arrays', topics: [ { id: 't1', items: [ { id: 'x', title: 'Two Sum' }, { id: 'y', title: '3Sum' }, { id: 'z', title: 'Trap' } ] } ] },
            { id: 'm0', topics: [ { id: 't0', items: [ { id: 'opt', optional: true } ] } ] },
        ], EnrollmentStatus.Paused );
        const other = tree( 'eB', 'pB', 'Design', [ { id: 'm2', title: 'Caching', topics: [ { id: 't2', items: [ { id: 'x', optional: true } ] } ] } ] );
        const result = computeReadiness( {
            goal: goal( '2026-10-01', [ 'eA', 'eB' ] ), timeZone: 'UTC', now: NOW, trees: [ fresh, other ], sessions: [], progress: [],
        } );
        const readiness = result.readiness!;

        expect( result.goal ).toMatchObject( { title: 'SDE interview', enrollmentIds: [ 'eA', 'eB' ] } );
        // Only revision has points: (100×15) / 100.
        expect( readiness ).toMatchObject( { score: 15, label: 'Just started', daysLeft: 0 } );
        expect( readiness.categories[0].checks ).toEqual( [ { label: 'DSA · Arrays', done: false, detail: '0/3' } ] );
        expect( readiness.categories[2].checks ).toEqual( [
            { label: 'Nothing left to revise', done: true, detail: null },
            { label: 'Nothing waiting more than 14 days', done: true, detail: null },
        ] );
        expect( readiness.pace ).toEqual( { itemsPerDay: 0, neededPerDay: null, projectedDate: null, onTrack: false } );
        expect( readiness.nextSteps ).toEqual( [
            { kind: 'module', priority: 'high', title: 'Finish Arrays: 3 required items left', detail: 'Next up: Two Sum, 3Sum', enrollmentId: 'eA', topicId: 't1', itemId: 'x' },
            { kind: 'resume', priority: 'medium', title: 'Resume DSA', detail: 'Paused · 3 items left', enrollmentId: 'eA', topicId: null, itemId: null },
        ] );
    } );

    it( 'with several items to revise, points at the one waiting longest', () => {
        const revise = tree( 'eA', 'pA', 'DSA', [ { id: 'm1', topics: [ { id: 't1', items: [
            { id: 'r1', title: 'Recent', progress: Revise },
            { id: 'r2', title: 'Old', progress: Revise },
        ] } ] } ] );
        const readiness = run( {
            trees: [ revise ],
            progress: [
                progress( 'r1', Revise, '2026-10-01T00:00:00Z', '2026-10-17T00:00:00Z' ),
                progress( 'r2', Revise, '2026-09-01T00:00:00Z', '2026-10-09T00:00:00Z' ),
            ],
        } );

        expect( readiness.categories[2] ).toEqual( { key: 'revision', score: 80, checks: [
            { label: 'Nothing left to revise', done: false, detail: '2 marked Revise' },
            { label: 'Nothing waiting more than 14 days', done: true, detail: 'oldest 10d' },
        ] } );
        expect( readiness.nextSteps ).toContainEqual( expect.objectContaining( {
            title: 'Clear your 2 Revise items', detail: 'Oldest: Old, marked 10 days ago', itemId: 'r2',
        } ) );
    } );

    it( 'scores 0 coverage when the goal\'s paths have nothing required', () => {
        const empty = tree( 'eA', 'pA', 'DSA', [] );

        expect( run( { trees: [ empty ] } ).categories[0] ).toEqual( { key: 'coverage', score: 0, checks: [] } );
    } );
} );
