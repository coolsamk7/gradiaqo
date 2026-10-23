import type { Analytics, AnalyticsPeriod, EnrollmentDetail, InterviewGoal, Readiness } from '@studylog/schemas';
import { Difficulty, EnrollmentStatus, ItemType, ProgressStatus } from '@studylog/schemas/enums';

import { addDays, computeStreaks, lastDays, startOfWeek, toLocalDate } from './stats-dates.js';

/*
 * Analytics and interview readiness, computed from what the user records: their enrollments (each a tree with
 * progress), their study sessions and their item progress. Pure functions, so every rule is tested directly; the
 * services only load the data.
 */

export interface SessionRow {
    startedAt: Date;
    durationMinutes: number;
    topicId: string | null;
    itemId: string | null;
    /** The path of the session's topic, if the topic still exists. */
    learningPathId: string | null;
}

export interface ProgressRow {
    itemId: string;
    status: ProgressStatus;
    /** First time the item was done (kept when it's later marked for revision). */
    completedAt: Date | null;
    /** Last status change: for an item marked Revise, since when it waits. */
    updatedAt: Date;
}

type Tree = EnrollmentDetail;
type TreeModule = Tree['modules'][number];
type TreeTopic = TreeModule['topics'][number];
type TreeItem = TreeTopic['items'][number];

interface Entry {
    tree: Tree;
    module: TreeModule;
    topic: TreeTopic;
    item: TreeItem;
}

const FINISHED: ProgressStatus[] = [ ProgressStatus.Done, ProgressStatus.Revise ];
const DIFFICULTIES = [ Difficulty.Easy, Difficulty.Medium, Difficulty.Hard ];
const DAY_MS = 24 * 60 * 60 * 1000;
const MOCK = /\bmock\b/i;

export const READINESS_WEIGHTS = { coverage: 40, depth: 25, revision: 15, consistency: 20 } as const;

const isFinished = ( item: TreeItem ) => FINISHED.includes( item.progress );
const sum = ( values: number[] ) => values.reduce( ( total, value ) => total + value, 0 );
const plural = ( count: number, word: string ) => `${count} ${word}${count === 1 ? '' : 's'}`;
const roundOne = ( value: number ) => Math.round( value * 10 ) / 10;
const daysBetween = ( from: string, to: string ) => Math.round( ( Date.parse( to ) - Date.parse( from ) ) / DAY_MS );
const share = ( { completed, total }: { completed: number; total: number } ) => completed / total;

function labelFor( score: number ): NonNullable<Readiness['readiness']>['label'] {
    if ( score >= 85 ) {
        return 'Ready';
    }
    if ( score >= 65 ) {
        return 'Almost ready';
    }

    return score >= 40 ? 'Getting there' : 'Just started';
}

/** Every item occurrence in the trees, in the user's order. */
function entriesOf( trees: Tree[] ): Entry[] {
    return trees.flatMap( ( tree ) => tree.modules.flatMap( ( module ) =>
        module.topics.flatMap( ( topic ) => topic.items.map( ( item ) => ( { tree, module, topic, item } ) ) ) ) );
}

/** One entry per item (an item can sit in several topics); required if it's required anywhere. */
function uniqueItems( entries: Entry[] ): ( Entry & { required: boolean } )[] {
    const byId = new Map<string, Entry & { required: boolean }>();

    for ( const entry of entries ) {
        const seen = byId.get( entry.item.id );

        if ( seen ) {
            seen.required ||= !entry.item.isOptional;
        } else {
            byId.set( entry.item.id, { ...entry, required: !entry.item.isOptional } );
        }
    }

    return [ ...byId.values() ];
}

/** Local calendar date, weekday and hour of an instant in a time zone. */
function localClock( timeZone: string ) {
    const parts = new Intl.DateTimeFormat( 'en-US', { timeZone, weekday: 'long', hour: 'numeric', hourCycle: 'h23' } );

    return ( instant: Date ) => {
        const values = Object.fromEntries( parts.formatToParts( instant )
            .map( ( part ) => [ part.type, part.value ] ) );

        return { date: toLocalDate( instant, timeZone ), weekday: values.weekday, hour: Number( values.hour ) };
    };
}

// ---------- Analytics ----------

const PERIOD_DAYS: Record<Exclude<AnalyticsPeriod, 'all'>, number> = { '30d': 30, '90d': 90 };
const WEEKS: Record<Exclude<AnalyticsPeriod, 'all'>, number> = { '30d': 12, '90d': 13 };

export interface AnalyticsInput {
    period: AnalyticsPeriod;
    timeZone: string;
    now: Date;
    trees: Tree[];
    sessions: SessionRow[];
    progress: ProgressRow[];
    /** Only sessions in these trees' paths count (when the user picked one path). */
    scoped: boolean;
}

export function computeAnalytics( input: AnalyticsInput ): Analytics {
    const { period, timeZone, now, trees, sessions, progress, scoped } = input;
    const clock = localClock( timeZone );
    const today = toLocalDate( now, timeZone );
    // All time has no start and nothing before it to compare with.
    const days = period === 'all' ? 0 : PERIOD_DAYS[period];
    const from = days === 0 ? null : addDays( today, 1 - days );
    const pathIds = new Set( trees.map( ( tree ) => tree.learningPath.id ) );
    const timed = ( scoped ? sessions.filter( ( session ) => pathIds.has( session.learningPathId ?? '' ) ) : sessions )
        .map( ( session ) => ( { ...session, ...clock( session.startedAt ) } ) );
    const inPeriod = timed.filter( ( session ) => from === null || session.date >= from );
    const minutesOf = ( list: typeof timed ) => sum( list.map( ( session ) => session.durationMinutes ) );
    const entries = entriesOf( trees );
    const items = uniqueItems( entries );
    const completedAt = new Map( progress.map( ( row ) => [ row.itemId, row.completedAt ] ) );
    const topics = trees.flatMap( ( tree ) => tree.modules.flatMap( ( module ) =>
        module.topics.map( ( topic ) => ( { tree, module, topic } ) ) ) );
    const counted = topics.filter( ( { topic } ) => topic.progress.total > 0 );

    return {
        period,
        timeZone,
        from,
        to: today,
        totals: {
            minutes: minutesOf( inPeriod ),
            previousMinutes: from === null
                ? null
                : minutesOf( timed.filter( ( { date } ) => date < from && date >= addDays( from, -days ) ) ),
            sessions: inPeriod.length,
            itemsDone: items.filter( ( { item } ) => {
                const at = completedAt.get( item.id );

                return at !== undefined && at !== null && ( from === null || toLocalDate( at, timeZone ) >= from );
            } ).length,
            itemsDoneTotal: items.filter( ( { item } ) => isFinished( item ) ).length,
            topicsCompleted: counted.filter( ( { topic } ) => share( topic.progress ) === 1 ).length,
            topicsTotal: counted.length,
            toRevise: items.filter( ( { item } ) => item.progress === ProgressStatus.Revise ).length,
        },
        weeks: weeksOf( timed, today, period ),
        byPath: trees
            .map( ( tree ) => ( {
                enrollmentId: tree.id,
                title: tree.learningPath.title,
                minutes: minutesOf( inPeriod.filter( ( session ) => session.learningPathId === tree.learningPath.id ) ),
            } ) )
            .filter( ( path ) => path.minutes > 0 )
            .sort( ( a, b ) => b.minutes - a.minutes ),
        itemStatus: {
            done: items.filter( ( { item } ) => item.progress === ProgressStatus.Done ).length,
            revise: items.filter( ( { item } ) => item.progress === ProgressStatus.Revise ).length,
            inProgress: items.filter( ( { item } ) => item.progress === ProgressStatus.InProgress ).length,
            notStarted: items.filter( ( { item } ) => item.progress === ProgressStatus.NotStarted ).length,
        },
        difficulty: DIFFICULTIES.map( ( difficulty ) => {
            const level = items.filter( ( { item } ) => item.difficulty === difficulty );

            return { difficulty, done: level.filter( ( { item } ) => isFinished( item ) ).length, total: level.length };
        } ),
        habits: habitsOf( inPeriod ),
        focus: focusOf( topics, timed ),
    };
}

/** 12 weeks for 30 days, 13 for 90 days; for all time, from the first session's week (12 to 52 weeks). */
function weeksOf( sessions: { date: string; durationMinutes: number }[], today: string, period: AnalyticsPeriod ) {
    const thisWeek = startOfWeek( today );
    const first = sessions.reduce<string | null>(
        ( min, session ) => ( min === null || session.date < min ? session.date : min ),
        null,
    );
    const sinceFirst = first === null ? 0 : daysBetween( startOfWeek( first ), thisWeek ) / 7 + 1;
    const count = period === 'all' ? Math.min( 52, Math.max( 12, sinceFirst ) ) : WEEKS[period];

    return Array.from( { length: count }, ( _, index ) => {
        const weekStart = addDays( thisWeek, ( index - count + 1 ) * 7 );
        const weekEnd = addDays( weekStart, 6 );

        return {
            weekStart,
            minutes: sum( sessions
                .filter( ( session ) => session.date >= weekStart && session.date <= weekEnd )
                .map( ( session ) => session.durationMinutes ) ),
        };
    } );
}

function habitsOf( sessions: { weekday: string; hour: number; durationMinutes: number }[] ): Analytics['habits'] {
    const total = sum( sessions.map( ( session ) => session.durationMinutes ) );
    const most = <K>( key: ( session: ( typeof sessions )[number] ) => K ): K | null => {
        const minutes = new Map<K, number>();

        for ( const session of sessions ) {
            minutes.set( key( session ), ( minutes.get( key( session ) ) ?? 0 ) + session.durationMinutes );
        }

        return [ ...minutes ].sort( ( a, b ) => b[1] - a[1] )[0]?.[0] ?? null;
    };
    const block = most( ( session ) => Math.floor( session.hour / 3 ) );
    const weekday = most( ( session ) => session.weekday );

    return {
        sessions: sessions.length,
        averageSessionMinutes: sessions.length === 0 ? 0 : Math.round( total / sessions.length ),
        bestWeekday: weekday,
        mostActiveHours: block === null ? null : { from: block * 3, to: block * 3 + 3 },
    };
}

/** Unfinished topics that need attention: items to revise first, then the least done, then the longest unstudied. */
function focusOf(
    topics: { tree: Tree; module: TreeModule; topic: TreeTopic }[],
    sessions: { topicId: string | null; date: string }[],
): Analytics['focus'] {
    const lastStudied = new Map<string, string>();

    for ( const session of sessions ) {
        if ( session.topicId && session.date > ( lastStudied.get( session.topicId ) ?? '' ) ) {
            lastStudied.set( session.topicId, session.date );
        }
    }

    return topics
        .filter( ( { topic } ) => topic.progress.total > 0 && topic.progress.completed < topic.progress.total )
        .map( ( { tree, module, topic } ) => ( {
            enrollmentId: tree.id,
            pathTitle: tree.learningPath.title,
            moduleTitle: module.title,
            topicId: topic.id,
            topicTitle: topic.title,
            completed: topic.progress.completed,
            total: topic.progress.total,
            toRevise: topic.items.filter( ( item ) => item.progress === ProgressStatus.Revise ).length,
            lastStudiedOn: lastStudied.get( topic.id ) ?? null,
            next: nextItems( topic.items ).slice( 0, 2 ).map( ( item ) => ( { id: item.id, title: item.title } ) ),
        } ) )
        .sort( ( a, b ) => b.toRevise - a.toRevise
            || a.completed / a.total - b.completed / b.total
            || ( a.lastStudiedOn ?? '' ).localeCompare( b.lastStudiedOn ?? '' ) )
        .slice( 0, 4 );
}

/** Items still to do, required ones first, each group in the user's order. */
function nextItems( items: TreeItem[] ): TreeItem[] {
    const open = items.filter( ( item ) => !isFinished( item ) );

    return [ ...open.filter( ( item ) => !item.isOptional ), ...open.filter( ( item ) => item.isOptional ) ];
}

// ---------- Interview readiness ----------

export interface ReadinessInput {
    goal: InterviewGoal;
    timeZone: string;
    now: Date;
    /** The goal's enrollments the user still has. */
    trees: Tree[];
    sessions: SessionRow[];
    progress: ProgressRow[];
}

type Category = NonNullable<Readiness['readiness']>['categories'][number];
type Check = Category['checks'][number];
type Step = NonNullable<Readiness['readiness']>['nextSteps'][number];

export function computeReadiness( { goal, timeZone, now, trees, sessions, progress }: ReadinessInput ): Readiness {
    const today = toLocalDate( now, timeZone );
    const daysLeft = Math.max( 0, daysBetween( today, goal.targetDate ) );
    const entries = entriesOf( trees );
    const items = uniqueItems( entries );
    const required = items.filter( ( entry ) => entry.required );
    const remaining = required.filter( ( { item } ) => !isFinished( item ) );
    const progressById = new Map( progress.map( ( row ) => [ row.itemId, row ] ) );
    const studyDays = sessions.map( ( session ) => toLocalDate( session.startedAt, timeZone ) );

    const coverage = coverageOf( trees, required.length, required.length - remaining.length );
    const depth = depthOf( entries, items, coverage.score );
    const revision = revisionOf( items, progressById, timeZone, today );
    const mocks = items.filter( ( { item } ) => item.type === ItemType.Exercise && MOCK.test( item.title ) );
    const consistency = consistencyOf( studyDays, today, mocks, sessions, timeZone );
    const categories = [ coverage, depth, revision.category, consistency.category ];
    const weighted = categories.map( ( { key, score: points } ) => points * READINESS_WEIGHTS[key] );
    const score = Math.round( sum( weighted ) / 100 );

    const recentlyDone = required.filter( ( { item } ) => {
        const at = progressById.get( item.id )?.completedAt;

        return at !== undefined && at !== null && toLocalDate( at, timeZone ) >= addDays( today, -13 );
    } ).length;
    const itemsPerDay = roundOne( recentlyDone / 14 );
    const neededPerDay = daysLeft > 0 ? roundOne( remaining.length / daysLeft ) : null;

    return {
        goal,
        readiness: {
            score,
            label: labelFor( score ),
            weights: { ...READINESS_WEIGHTS },
            daysLeft,
            pace: {
                itemsPerDay,
                neededPerDay,
                projectedDate: remaining.length === 0 || itemsPerDay === 0
                    ? null
                    : addDays( today, Math.ceil( remaining.length / itemsPerDay ) ),
                onTrack: remaining.length === 0 || ( neededPerDay !== null && itemsPerDay >= neededPerDay ),
            },
            categories,
            nextSteps: nextStepsOf( trees, revision, consistency.mockDue ).slice( 0, 5 ),
        },
    };
}

/** Required items finished, with a check per module (up to six). */
function coverageOf( trees: Tree[], total: number, done: number ): Category {
    const modules = trees.flatMap( ( tree ) => tree.modules
        .filter( ( module ) => module.progress.total > 0 )
        .map( ( module ) => ( { tree, module } ) ) );

    return {
        key: 'coverage',
        score: total === 0 ? 0 : Math.round( ( done / total ) * 100 ),
        checks: modules.slice( 0, 6 ).map( ( { tree, module } ) => ( {
            label: trees.length > 1 ? `${tree.learningPath.title} · ${module.title}` : module.title,
            done: module.progress.completed === module.progress.total,
            detail: `${module.progress.completed}/${module.progress.total}`,
        } ) ),
    };
}

/** Harder items count more: easy 20%, medium 40%, hard 40% (shared out over the levels the goal has). */
function depthOf( entries: Entry[], items: Entry[], fallback: number ): Category {
    const weight = { [Difficulty.Easy]: 20, [Difficulty.Medium]: 40, [Difficulty.Hard]: 40 };
    const levels = DIFFICULTIES
        .map( ( difficulty ) => {
            const level = items.filter( ( { item } ) => item.difficulty === difficulty );

            return { difficulty, done: level.filter( ( { item } ) => isFinished( item ) ).length, total: level.length };
        } )
        .filter( ( level ) => level.total > 0 );
    const shares = sum( levels.map( ( level ) => weight[level.difficulty] ) );
    const checks: Check[] = levels.map( ( level ) => ( {
        label: level.difficulty.charAt( 0 ).toUpperCase() + level.difficulty.slice( 1 ),
        done: level.done === level.total,
        detail: `${level.done}/${level.total}`,
    } ) );
    const hardModules = new Map<string, boolean>();

    for ( const { module, item } of entries ) {
        if ( item.difficulty === Difficulty.Hard ) {
            hardModules.set( module.id, ( hardModules.get( module.id ) ?? false ) || isFinished( item ) );
        }
    }
    if ( hardModules.size > 0 ) {
        const withHardDone = [ ...hardModules.values() ].filter( Boolean ).length;

        checks.push( { label: 'A hard problem in every module', done: withHardDone === hardModules.size, detail: `${withHardDone}/${hardModules.size}` } );
    }

    const weighted = sum( levels.map( ( level ) => ( level.done / level.total ) * weight[level.difficulty] ) );

    // Without difficulties there is nothing to weigh: depth follows coverage.
    return { key: 'depth', score: levels.length === 0 ? fallback : Math.round( ( weighted / shares ) * 100 ), checks };
}

/** Coming back to items marked Revise: 10 points off per item, 20 more if one waits over two weeks. */
function revisionOf( items: Entry[], progressById: Map<string, ProgressRow>, timeZone: string, today: string ) {
    const waiting = items
        .filter( ( { item } ) => item.progress === ProgressStatus.Revise )
        .map( ( entry ) => {
            const since = progressById.get( entry.item.id )?.updatedAt;

            return { entry, days: since ? daysBetween( toLocalDate( since, timeZone ), today ) : 0 };
        } )
        .sort( ( a, b ) => b.days - a.days );
    const oldest = waiting[0];
    const overdue = oldest !== undefined && oldest.days > 14;

    return {
        count: waiting.length,
        oldest,
        category: {
            key: 'revision',
            score: Math.max( 0, 100 - waiting.length * 10 - ( overdue ? 20 : 0 ) ),
            checks: [
                { label: 'Nothing left to revise', done: waiting.length === 0, detail: waiting.length ? `${waiting.length} marked Revise` : null },
                { label: 'Nothing waiting more than 14 days', done: !overdue, detail: oldest ? `oldest ${oldest.days}d` : null },
            ],
        } satisfies Category,
    };
}

/** Studying regularly: 60% days studied in the last two weeks (10 is full marks), 40% the streak (7 is full marks). */
function consistencyOf( studyDays: string[], today: string, mocks: Entry[], sessions: SessionRow[], timeZone: string ) {
    const recent = new Set( studyDays.filter( ( day ) => lastDays( today, 14 ).includes( day ) ) ).size;
    const { current } = computeStreaks( studyDays, today );
    const mockIds = new Set( mocks.map( ( { item } ) => item.id ) );
    const mockDone = sessions.some( ( session ) => session.itemId !== null && mockIds.has( session.itemId )
        && toLocalDate( session.startedAt, timeZone ) >= addDays( today, -6 ) );
    const checks: Check[] = [
        { label: `${current}-day streak`, done: current >= 3, detail: null },
        { label: 'Studied on 10 of the last 14 days', done: recent >= 10, detail: `${recent}/14` },
    ];

    if ( mocks.length > 0 ) {
        checks.push( { label: 'A mock interview in the last 7 days', done: mockDone, detail: null } );
    }

    return {
        mockDue: mocks.length > 0 && !mockDone ? mocks[0] : undefined,
        category: {
            key: 'consistency',
            score: Math.round( Math.min( 1, recent / 10 ) * 60 + ( Math.min( current, 7 ) / 7 ) * 40 ),
            checks,
        } satisfies Category,
    };
}

function nextStepsOf(
    trees: Tree[],
    revise: { count: number; oldest?: { entry: Entry; days: number } },
    mock: Entry | undefined,
): Step[] {
    const steps: Step[] = [];
    const step = ( kind: Step['kind'], priority: Step['priority'], title: string, detail: string, tree: Tree, entry?: Entry ): Step => ( {
        kind,
        priority,
        title,
        detail,
        enrollmentId: tree.id,
        topicId: entry?.topic.id ?? null,
        itemId: entry?.item.id ?? null,
    } );

    // The least finished module that still has required items to do.
    const modules = trees.flatMap( ( tree ) => tree.modules.map( ( module ) => ( { tree, module } ) ) )
        .filter( ( { module } ) => module.progress.completed < module.progress.total )
        .sort( ( a, b ) => share( a.module.progress ) - share( b.module.progress ) );
    const weakest = modules[0];

    if ( weakest ) {
        const todo = entriesOf( [ weakest.tree ] )
            .filter( ( { module, item } ) =>
                module.id === weakest.module.id && !item.isOptional && !isFinished( item ) );
        const left = weakest.module.progress.total - weakest.module.progress.completed;

        steps.push( step(
            'module',
            'high',
            `Finish ${weakest.module.title}: ${plural( left, 'required item' )} left`,
            `Next up: ${todo.slice( 0, 2 ).map( ( { item } ) => item.title ).join( ', ' )}`,
            weakest.tree,
            todo[0],
        ) );
    }
    if ( mock ) {
        steps.push( step( 'mock', 'high', 'Do a mock interview', `${mock.item.title}, in ${mock.tree.learningPath.title}`, mock.tree, mock ) );
    }
    if ( revise.oldest ) {
        steps.push( step(
            'revise',
            'medium',
            `Clear your ${plural( revise.count, 'Revise item' )}`,
            `Oldest: ${revise.oldest.entry.item.title}, marked ${plural( revise.oldest.days, 'day' )} ago`,
            revise.oldest.entry.tree,
            revise.oldest.entry,
        ) );
    }
    for ( const tree of trees.filter( ( candidate ) => candidate.status === EnrollmentStatus.Paused ) ) {
        const left = tree.progress.total - tree.progress.completed;

        steps.push( step( 'resume', 'medium', `Resume ${tree.learningPath.title}`, `Paused · ${plural( left, 'item' )} left`, tree ) );
    }

    const hard = entriesOf( trees ).find( ( { item } ) => item.difficulty === Difficulty.Hard && !isFinished( item ) );

    if ( hard ) {
        steps.push( step( 'hard', 'low', 'Try a hard problem', `${hard.item.title} · ${hard.topic.title}`, hard.tree, hard ) );
    }

    return steps;
}
