import type { StaticDecode } from 'typebox';
import Type from 'typebox';

import { Item, LearningModule, LearningPath, Topic, TopicItem } from './catalog.js';
import {
    EnrollmentStatus,
    OrderParentType,
    ProgressStatus,
    ReportReason,
    ReportStatus,
    RuleMode,
    RuleScope,
} from './enums.js';
import { IsoDate, NullableIsoDate, TrimmedText, Uuid } from './primitives.js';

/*
 * A user's side of the catalog: which paths they follow (enrollments), which parts (rules), in what order
 * (orders), how far they got (progress) and the time they spent (study sessions). Catalog content is only
 * referenced, never copied.
 */

// ---------- Browsing the published catalog ----------

export const PublishedTopic = Type.Object( { ...Topic.properties, items: Type.Array( TopicItem ) } );
export const PublishedModule = Type.Object( { ...LearningModule.properties, topics: Type.Array( PublishedTopic ) } );

/** A published path with its published content, in the admin's order. */
/** Where a path comes from, to tell official paths from users' own. */
const PathOrigin = {
    organization: Type.Union( [
        Type.Object( { id: Uuid(), name: Type.String(), isPersonal: Type.Boolean() } ),
        Type.Null(),
    ], { description: 'Null for official (global catalog) paths' } ),
    createdBy: Type.Union( [
        Type.Object( { id: Uuid(), firstName: Type.String(), lastName: Type.String() } ),
        Type.Null(),
    ], { description: 'Null for official paths, or if the creator deleted their account' } ),
    enrollmentId: Type.Union( [ Uuid(), Type.Null() ], { description: 'Your enrollment in this path, if any' } ),
};

export const PublishedPathSummary = Type.Object( { ...LearningPath.properties, ...PathOrigin } );
export type PublishedPathSummary = StaticDecode<typeof PublishedPathSummary>;

export const PublishedPath = Type.Object( {
    ...PublishedPathSummary.properties,
    modules: Type.Array( PublishedModule ),
} );
export type PublishedPath = StaticDecode<typeof PublishedPath>;

export enum PathSource {
    /** The global catalog. */
    Official = 'official',
    /** Your personal workspace. */
    Mine = 'mine',
    /** Shared organizations you belong to. */
    Organizations = 'organizations',
    /** Paths other users made public. */
    Community = 'community',
}

export const ListPublishedPathsQuery = Type.Object(
    {
        source: Type.Optional( Type.Enum( PathSource ) ),
        search: Type.Optional( Type.String( { minLength: 1, maxLength: 100, description: 'Matches the title' } ) ),
    },
    { additionalProperties: false },
);
export type ListPublishedPathsQuery = StaticDecode<typeof ListPublishedPathsQuery>;

// ---------- Progress ----------

export const ProgressCount = Type.Object(
    {
        completed: Type.Integer( { description: 'Required items that are done or marked for revision' } ),
        total: Type.Integer( { description: 'Required (non-optional) items' } ),
    },
    { description: 'Each item counts once, even when it appears in several topics' },
);
export type ProgressCount = StaticDecode<typeof ProgressCount>;

export const ItemProgress = Type.Object( {
    itemId: Uuid(),
    status: Type.Enum( ProgressStatus ),
    startedAt: NullableIsoDate(),
    completedAt: NullableIsoDate(),
    updatedAt: NullableIsoDate(),
} );
export type ItemProgress = StaticDecode<typeof ItemProgress>;

export const ItemProgressWithItem = Type.Object( { ...ItemProgress.properties, item: Item } );
export type ItemProgressWithItem = StaticDecode<typeof ItemProgressWithItem>;

export const UpdateProgressRequest = Type.Object(
    { status: Type.Enum( ProgressStatus, { description: '`not_started` clears the progress' } ) },
    { additionalProperties: false },
);
export type UpdateProgressRequest = StaticDecode<typeof UpdateProgressRequest>;

export const ListProgressQuery = Type.Object(
    {
        status: Type.Optional( Type.Enum( ProgressStatus ) ),
        limit: Type.Optional( Type.Integer( { minimum: 1, maximum: 200, default: 50 } ) ),
        offset: Type.Optional( Type.Integer( { minimum: 0, default: 0 } ) ),
    },
    { additionalProperties: false },
);
export type ListProgressQuery = StaticDecode<typeof ListProgressQuery>;

export const ItemProgressPage = Type.Object( { items: Type.Array( ItemProgressWithItem ), total: Type.Integer() } );
export type ItemProgressPage = StaticDecode<typeof ItemProgressPage>;

// ---------- Enrollments ----------

export const EnrollmentRule = Type.Object( {
    scope: Type.Enum( RuleScope ),
    scopeId: Uuid(),
    mode: Type.Enum( RuleMode ),
} );
export type EnrollmentRule = StaticDecode<typeof EnrollmentRule>;

export const EnrollmentOrder = Type.Object( {
    parentType: Type.Enum( OrderParentType ),
    parentId: Uuid(),
    orderedIds: Type.Array( Uuid() ),
} );
export type EnrollmentOrder = StaticDecode<typeof EnrollmentOrder>;

export const Enrollment = Type.Object( {
    id: Uuid(),
    status: Type.Enum( EnrollmentStatus ),
    position: Type.Integer( { description: 'Order on your dashboard, ascending' } ),
    enrolledAt: IsoDate(),
    updatedAt: IsoDate(),
    learningPath: LearningPath,
    progress: ProgressCount,
} );
export type Enrollment = StaticDecode<typeof Enrollment>;

export const MyTopicItem = Type.Object( { ...TopicItem.properties, progress: Type.Enum( ProgressStatus ) } );
export type MyTopicItem = StaticDecode<typeof MyTopicItem>;

export const MyTopic = Type.Object( {
    ...Topic.properties,
    progress: ProgressCount,
    items: Type.Array( MyTopicItem ),
} );
export type MyTopic = StaticDecode<typeof MyTopic>;

export const MyModule = Type.Object( {
    ...LearningModule.properties,
    progress: ProgressCount,
    topics: Type.Array( MyTopic ),
} );
export type MyModule = StaticDecode<typeof MyModule>;

/** An enrollment with the content it selects, in the user's order, and progress at every level. */
export const EnrollmentDetail = Type.Object( {
    ...Enrollment.properties,
    rules: Type.Array( EnrollmentRule ),
    orders: Type.Array( EnrollmentOrder ),
    modules: Type.Array( MyModule ),
} );
export type EnrollmentDetail = StaticDecode<typeof EnrollmentDetail>;

export const CreateEnrollmentRequest = Type.Object(
    {
        learningPathId: Uuid(),
        rules: Type.Optional( Type.Array( EnrollmentRule, {
            maxItems: 500,
            description: 'Pick parts of the path. Without include rules you get the whole path.',
        } ) ),
    },
    { additionalProperties: false },
);
export type CreateEnrollmentRequest = StaticDecode<typeof CreateEnrollmentRequest>;

export const UpdateEnrollmentRequest = Type.Object(
    { status: Type.Enum( EnrollmentStatus ) },
    { additionalProperties: false },
);
export type UpdateEnrollmentRequest = StaticDecode<typeof UpdateEnrollmentRequest>;

export const ReplaceRulesRequest = Type.Object(
    { rules: Type.Array( EnrollmentRule, { maxItems: 500 } ) },
    { additionalProperties: false },
);
export type ReplaceRulesRequest = StaticDecode<typeof ReplaceRulesRequest>;

// ---------- Study sessions ----------

export const StudySession = Type.Object( {
    id: Uuid(),
    topicId: Type.Union( [ Uuid(), Type.Null() ] ),
    itemId: Type.Union( [ Uuid(), Type.Null() ] ),
    startedAt: IsoDate(),
    durationMinutes: Type.Integer(),
    notes: Type.Union( [ Type.String(), Type.Null() ] ),
    createdAt: IsoDate(),
    updatedAt: IsoDate(),
} );
export type StudySession = StaticDecode<typeof StudySession>;

export const StudySessionPage = Type.Object( { items: Type.Array( StudySession ), total: Type.Integer() } );
export type StudySessionPage = StaticDecode<typeof StudySessionPage>;

const SessionInput = {
    topicId: Type.Optional( Type.Union( [ Uuid(), Type.Null() ] ) ),
    itemId: Type.Optional( Type.Union( [ Uuid(), Type.Null() ] ) ),
    startedAt: IsoDate(),
    durationMinutes: Type.Integer( { minimum: 1, maximum: 24 * 60 } ),
    notes: Type.Optional( Type.Union( [ Type.String( { maxLength: 10_000 } ), Type.Null() ] ) ),
};

export const CreateStudySessionRequest = Type.Object( SessionInput, {
    additionalProperties: false,
    description: 'Needs a topic, an item or both. startedAt can\'t be in the future.',
} );
export type CreateStudySessionRequest = StaticDecode<typeof CreateStudySessionRequest>;

export const UpdateStudySessionRequest = Type.Partial( CreateStudySessionRequest );
export type UpdateStudySessionRequest = StaticDecode<typeof UpdateStudySessionRequest>;

export const ListStudySessionsQuery = Type.Object(
    {
        from: Type.Optional( IsoDate() ),
        to: Type.Optional( IsoDate() ),
        topicId: Type.Optional( Uuid() ),
        itemId: Type.Optional( Uuid() ),
        limit: Type.Optional( Type.Integer( { minimum: 1, maximum: 200, default: 50 } ) ),
        offset: Type.Optional( Type.Integer( { minimum: 0, default: 0 } ) ),
    },
    { additionalProperties: false, description: '`from` inclusive, `to` exclusive, on startedAt' },
);
export type ListStudySessionsQuery = StaticDecode<typeof ListStudySessionsQuery>;

// ---------- Stats ----------

export const StatsQuery = Type.Object(
    {
        timeZone: Type.Optional( Type.String( {
            maxLength: 64,
            description: 'IANA time zone for day boundaries. Default: UTC',
            examples: [ 'Asia/Kolkata' ],
        } ) ),
    },
    { additionalProperties: false },
);
export type StatsQuery = StaticDecode<typeof StatsQuery>;

export const DailyMinutes = Type.Object( {
    date: Type.String( { format: 'date', examples: [ '2026-09-25' ] } ),
    minutes: Type.Integer(),
} );

export const StudyStats = Type.Object( {
    timeZone: Type.String(),
    todayMinutes: Type.Integer(),
    weekMinutes: Type.Integer( { description: 'Since Monday' } ),
    totalMinutes: Type.Integer(),
    currentStreakDays: Type.Integer( { description: 'Consecutive days with study, ending today (or yesterday)' } ),
    longestStreakDays: Type.Integer(),
    itemsCompleted: Type.Integer( { description: 'Items done or marked for revision' } ),
    last30Days: Type.Array( DailyMinutes, { description: 'Oldest first, including days with 0 minutes' } ),
} );
export type StudyStats = StaticDecode<typeof StudyStats>;

// ---------- Reports (moderation of public paths) ----------

export const CreateReportRequest = Type.Object(
    {
        reason: Type.Enum( ReportReason ),
        details: Type.Optional( TrimmedText( 2000 ) ),
    },
    { additionalProperties: false },
);
export type CreateReportRequest = StaticDecode<typeof CreateReportRequest>;

export const Report = Type.Object( {
    id: Uuid(),
    reason: Type.Enum( ReportReason ),
    details: Type.Union( [ Type.String(), Type.Null() ] ),
    status: Type.Enum( ReportStatus ),
    resolutionNote: Type.Union( [ Type.String(), Type.Null() ] ),
    resolvedAt: NullableIsoDate(),
    createdAt: IsoDate(),
    learningPath: Type.Object( {
        id: Uuid(),
        title: Type.String(),
        organizationId: Type.Union( [ Uuid(), Type.Null() ] ),
        visibility: LearningPath.properties.visibility,
    } ),
    reporter: Type.Union( [
        Type.Object( { id: Uuid(), email: Type.String(), firstName: Type.String(), lastName: Type.String() } ),
        Type.Null(),
    ] ),
} );
export type Report = StaticDecode<typeof Report>;

export const ListReportsQuery = Type.Object(
    {
        status: Type.Optional( Type.Enum( ReportStatus, { description: 'Default: open' } ) ),
        limit: Type.Optional( Type.Integer( { minimum: 1, maximum: 200, default: 50 } ) ),
        offset: Type.Optional( Type.Integer( { minimum: 0, default: 0 } ) ),
    },
    { additionalProperties: false },
);
export type ListReportsQuery = StaticDecode<typeof ListReportsQuery>;

export const ReportPage = Type.Object( { items: Type.Array( Report ), total: Type.Integer() } );
export type ReportPage = StaticDecode<typeof ReportPage>;

export enum ReportAction {
    Dismiss = 'dismiss',
    /** Take the path out of the public catalog for good (its owner keeps it, privately). */
    HidePath = 'hide_path',
}

export const ResolveReportRequest = Type.Object(
    {
        action: Type.Enum( ReportAction, {
            description: '`hide_path` also closes every other open report on the same path',
        } ),
        note: Type.Optional( TrimmedText( 2000 ) ),
    },
    { additionalProperties: false },
);
export type ResolveReportRequest = StaticDecode<typeof ResolveReportRequest>;
