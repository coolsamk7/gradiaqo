import type { StaticDecode, StaticEncode } from 'typebox';
import Type from 'typebox';

import { Difficulty } from './enums.js';
import { IsoDate, TrimmedText, Uuid } from './primitives.js';

/*
 * Insights computed from what the user already records (enrollments, item progress, study sessions): analytics on
 * how they study, and how ready they are for an interview goal they set.
 */

const Day = ( description?: string ) => Type.String( { format: 'date', examples: [ '2026-10-19' ], ...( description ? { description } : {} ) } );
const TimeZone = Type.Optional( Type.String( {
    maxLength: 64,
    description: 'IANA time zone for day boundaries. Default: UTC',
    examples: [ 'Asia/Kolkata' ],
} ) );

// ---------- Analytics ----------

export const AnalyticsPeriod = Type.Union( [ Type.Literal( '30d' ), Type.Literal( '90d' ), Type.Literal( 'all' ) ] );
export type AnalyticsPeriod = StaticDecode<typeof AnalyticsPeriod>;

export const AnalyticsQuery = Type.Object(
    {
        period: Type.Optional( Type.Union( AnalyticsPeriod.anyOf, { description: 'Default: 30d' } ) ),
        enrollmentId: Type.Optional( Type.String( { format: 'uuid', description: 'Only this path. Default: every path you follow' } ) ),
        timeZone: TimeZone,
    },
    { additionalProperties: false },
);
export type AnalyticsQuery = StaticDecode<typeof AnalyticsQuery>;

const ItemRef = Type.Object( { id: Uuid(), title: Type.String() } );

export const Analytics = Type.Object( {
    period: AnalyticsPeriod,
    timeZone: Type.String(),
    from: Type.Union( [ Day( 'First day of the period' ), Type.Null() ], { description: 'Null for all time' } ),
    to: Day( 'Today' ),
    totals: Type.Object( {
        minutes: Type.Integer( { description: 'Studied in the period' } ),
        previousMinutes: Type.Union( [ Type.Integer(), Type.Null() ], {
            description: 'Studied in the period of the same length just before. Null for all time',
        } ),
        sessions: Type.Integer(),
        itemsDone: Type.Integer( { description: 'Items first finished in the period' } ),
        itemsDoneTotal: Type.Integer( { description: 'Items done or marked for revision, ever' } ),
        topicsCompleted: Type.Integer(),
        topicsTotal: Type.Integer(),
        toRevise: Type.Integer( { description: 'Items marked for revision' } ),
    } ),
    weeks: Type.Array( Type.Object( { weekStart: Day( 'Monday' ), minutes: Type.Integer() } ), {
        description: 'Study time per week, oldest first; the last week is the current one',
    } ),
    byPath: Type.Array( Type.Object( { enrollmentId: Uuid(), title: Type.String(), minutes: Type.Integer() } ), {
        description: 'Study time per path in the period, most first. Paths without time are left out',
    } ),
    itemStatus: Type.Object( {
        done: Type.Integer(),
        revise: Type.Integer(),
        inProgress: Type.Integer(),
        notStarted: Type.Integer(),
    }, { description: 'Every item in the selected paths, each counted once' } ),
    difficulty: Type.Array( Type.Object( {
        difficulty: Type.Enum( Difficulty ),
        done: Type.Integer( { description: 'Done or marked for revision' } ),
        total: Type.Integer(),
    } ), { description: 'Easy, medium, hard: items that have a difficulty' } ),
    habits: Type.Object( {
        sessions: Type.Integer(),
        averageSessionMinutes: Type.Integer(),
        bestWeekday: Type.Union( [ Type.String( { examples: [ 'Sunday' ] } ), Type.Null() ], {
            description: 'The weekday with the most study time in the period',
        } ),
        mostActiveHours: Type.Union( [ Type.Object( {
            from: Type.Integer( { minimum: 0, maximum: 23 } ),
            to: Type.Integer( { minimum: 1, maximum: 24 } ),
        } ), Type.Null() ], { description: 'The 3-hour window of the day with the most study time' } ),
    } ),
    focus: Type.Array( Type.Object( {
        enrollmentId: Uuid(),
        pathTitle: Type.String(),
        moduleTitle: Type.String(),
        topicId: Uuid(),
        topicTitle: Type.String(),
        completed: Type.Integer(),
        total: Type.Integer(),
        toRevise: Type.Integer(),
        lastStudiedOn: Type.Union( [ Day(), Type.Null() ], { description: 'Null if never studied' } ),
        next: Type.Array( ItemRef, { description: 'Up to two items to do next, in your order' } ),
    } ), {
        description: 'Up to four unfinished topics that need attention: items to revise first, then the least done',
    } ),
} );
export type Analytics = StaticDecode<typeof Analytics>;
export type AnalyticsJson = StaticEncode<typeof Analytics>;

// ---------- Interview goal and readiness ----------

export const InterviewGoal = Type.Object( {
    title: Type.String( { examples: [ 'SDE interview' ] } ),
    targetDate: Day(),
    enrollmentIds: Type.Array( Uuid(), { description: 'The paths that count' } ),
    updatedAt: IsoDate(),
} );
export type InterviewGoal = StaticDecode<typeof InterviewGoal>;
export type InterviewGoalJson = StaticEncode<typeof InterviewGoal>;

export const SetInterviewGoalRequest = Type.Object(
    {
        title: TrimmedText( 100, [ 'SDE interview' ] ),
        targetDate: Day( 'Today or later' ),
        enrollmentIds: Type.Array( Uuid(), {
            minItems: 1,
            maxItems: 20,
            uniqueItems: true,
            description: 'Paths you follow that this goal is about',
        } ),
    },
    { additionalProperties: false },
);
export type SetInterviewGoalRequest = StaticDecode<typeof SetInterviewGoalRequest>;

export const ReadinessQuery = Type.Object( { timeZone: TimeZone }, { additionalProperties: false } );
export type ReadinessQuery = StaticDecode<typeof ReadinessQuery>;

export const ReadinessCategoryKey = Type.Union( [
    Type.Literal( 'coverage' ),
    Type.Literal( 'depth' ),
    Type.Literal( 'revision' ),
    Type.Literal( 'consistency' ),
] );

export const Readiness = Type.Object( {
    goal: Type.Union( [ InterviewGoal, Type.Null() ], { description: 'Null until you set a goal' } ),
    readiness: Type.Union( [ Type.Object( {
        score: Type.Integer( { minimum: 0, maximum: 100 } ),
        label: Type.Union( [
            Type.Literal( 'Ready' ),
            Type.Literal( 'Almost ready' ),
            Type.Literal( 'Getting there' ),
            Type.Literal( 'Just started' ),
        ] ),
        weights: Type.Object( {
            coverage: Type.Integer(),
            depth: Type.Integer(),
            revision: Type.Integer(),
            consistency: Type.Integer(),
        }, { description: 'Share of each category in the score, in percent' } ),
        daysLeft: Type.Integer( { description: 'Until the goal date; 0 on the day and after' } ),
        pace: Type.Object( {
            itemsPerDay: Type.Number( { description: 'Items finished per day over the last 14 days' } ),
            neededPerDay: Type.Union( [ Type.Number(), Type.Null() ], { description: 'To finish by the date; null if no time is left' } ),
            projectedDate: Type.Union( [ Day(), Type.Null() ], {
                description: 'When everything would be done at your pace; null without recent progress or if already done',
            } ),
            onTrack: Type.Boolean(),
        } ),
        categories: Type.Array( Type.Object( {
            key: ReadinessCategoryKey,
            score: Type.Integer( { minimum: 0, maximum: 100 } ),
            checks: Type.Array( Type.Object( {
                label: Type.String(),
                done: Type.Boolean(),
                detail: Type.Union( [ Type.String(), Type.Null() ] ),
            } ) ),
        } ) ),
        nextSteps: Type.Array( Type.Object( {
            kind: Type.Union( [
                Type.Literal( 'module' ),
                Type.Literal( 'mock' ),
                Type.Literal( 'revise' ),
                Type.Literal( 'resume' ),
                Type.Literal( 'hard' ),
            ], {
                description: 'module: finish the weakest module · mock: do a mock interview · revise: clear Revise items · '
                    + 'resume: resume a paused path · hard: try a hard problem',
            } ),
            priority: Type.Union( [ Type.Literal( 'high' ), Type.Literal( 'medium' ), Type.Literal( 'low' ) ] ),
            title: Type.String(),
            detail: Type.String(),
            enrollmentId: Type.Union( [ Uuid(), Type.Null() ] ),
            topicId: Type.Union( [ Uuid(), Type.Null() ] ),
            itemId: Type.Union( [ Uuid(), Type.Null() ] ),
        } ), { description: 'Up to five, most important first' } ),
    } ), Type.Null() ], { description: 'Null until you set a goal' } ),
} );
export type Readiness = StaticDecode<typeof Readiness>;
export type ReadinessJson = StaticEncode<typeof Readiness>;
