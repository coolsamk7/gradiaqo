/*
 * API answers for tests, typed with the API's own contract so they can't drift from it.
 */
import type { EnrollmentDetailJson, EnrollmentJson, StudySessionPageJson } from '@studylog/schemas';
import type { EnrollmentStatus } from '@studylog/schemas/enums';
import { CatalogStatus, ItemType, PathVisibility, ProgressStatus } from '@studylog/schemas/enums';

const DATE = '2026-09-01T09:00:00.000Z';

/** A valid, readable uuid: uuid( 7 ) → "00000000-0000-4000-8000-000000000007". */
export function uuid( n: number ): string {
    return `00000000-0000-4000-8000-${String( n ).padStart( 12, '0' )}`;
}

const node = ( id: string, title: string, position: number ) => ( {
    id,
    title,
    slug: title.toLowerCase().replace( /[^a-z0-9]+/g, '-' ),
    description: null,
    status: CatalogStatus.Published,
    position,
    createdAt: DATE,
    updatedAt: DATE,
} );

/** A learning path the user follows, with `completed` of `total` items done. */
export function enrollment(
    title: string,
    status: EnrollmentStatus,
    completed: number,
    total: number,
    id = uuid( 900 + completed ),
): EnrollmentJson {
    return {
        id,
        status,
        position: 0,
        enrolledAt: DATE,
        updatedAt: DATE,
        progress: { completed, total },
        learningPath: {
            ...node( uuid( 800 ), title, 0 ),
            organizationId: null,
            visibility: PathVisibility.Public,
            publicBlockedAt: null,
        },
    };
}

export interface TreeSpec {
    title: string;
    topics: { id: string; title: string; items: { id: string; title: string; optional?: boolean }[] }[];
}

/** An enrollment with its modules, topics and items (nothing started). */
export function enrollmentDetail( base: EnrollmentJson, modules: TreeSpec[] ): EnrollmentDetailJson {
    const progress = { completed: 0, total: 0 };

    return {
        ...base,
        rules: [],
        orders: [],
        modules: modules.map( ( module, m ) => ( {
            ...node( uuid( 700 + m ), module.title, m ),
            learningPathId: base.learningPath.id,
            progress,
            topics: module.topics.map( ( topic, t ) => ( {
                ...node( topic.id, topic.title, t ),
                moduleId: uuid( 700 + m ),
                progress,
                items: topic.items.map( ( item, i ) => ( {
                    id: item.id,
                    organizationId: null,
                    type: ItemType.Problem,
                    title: item.title,
                    description: null,
                    difficulty: null,
                    estimatedMinutes: null,
                    tags: [],
                    details: {},
                    status: CatalogStatus.Published,
                    createdAt: DATE,
                    updatedAt: DATE,
                    position: i,
                    isOptional: item.optional ?? false,
                    progress: ProgressStatus.NotStarted,
                } ) ),
            } ) ),
        } ) ),
    };
}

export type SessionJson = StudySessionPageJson['items'][number];

/** A listed study session; `about` sets what it was about (topic, item) and notes. */
export function session(
    id: string,
    startedAt: string,
    durationMinutes: number,
    about: Partial<SessionJson> = {},
): SessionJson {
    return {
        id,
        topicId: null,
        itemId: null,
        topic: null,
        item: null,
        startedAt,
        durationMinutes,
        notes: null,
        createdAt: startedAt,
        updatedAt: startedAt,
        ...about,
    };
}
