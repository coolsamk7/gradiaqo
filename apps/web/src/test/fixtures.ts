/*
 * API answers for tests, typed with the API's own contract so they can't drift from it.
 */
import type {
    EnrollmentDetailJson,
    EnrollmentJson,
    ItemJson as CatalogItemJson,
    LearningPathTreeJson,
    MyOrganizationJson,
    PublishedPathSummaryJson,
    StudySessionPageJson,
} from '@studylog/schemas';
import type { EnrollmentStatus } from '@studylog/schemas/enums';
import { CatalogStatus, ItemType, OrganizationRole, PathVisibility, ProgressStatus } from '@studylog/schemas/enums';

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

type ItemJson = EnrollmentDetailJson['modules'][number]['topics'][number]['items'][number];

/** An item in a tree: its id and title, and anything else that differs from a not-started problem. */
export type ItemSpec = Pick<ItemJson, 'id' | 'title'> & Partial<Omit<ItemJson, 'id' | 'title' | 'isOptional'>> & {
    optional?: boolean;
};

export interface TreeSpec {
    title: string;
    description?: string;
    topics: { id: string; title: string; description?: string; items: ItemSpec[] }[];
}

/** Required items done (or marked for revision) out of all required ones, like the API counts them. */
function count( items: ItemJson[] ) {
    const required = items.filter( ( item ) => !item.isOptional );
    const finished = [ ProgressStatus.Done, ProgressStatus.Revise ] as ProgressStatus[];

    const completed = required.filter( ( item ) => finished.includes( item.progress ) ).length;

    return { completed, total: required.length };
}

/** An enrollment with its modules, topics and items. Counts follow the items' statuses; the path's is `base`'s. */
export function enrollmentDetail( base: EnrollmentJson, modules: TreeSpec[] ): EnrollmentDetailJson {
    return {
        ...base,
        rules: [],
        orders: [],
        modules: modules.map( ( module, m ) => {
            const topics = module.topics.map( ( topic, t ) => {
                const items: ItemJson[] = topic.items.map( ( { optional, ...item }, i ) => ( {
                    organizationId: null,
                    type: ItemType.Problem,
                    description: null,
                    difficulty: null,
                    estimatedMinutes: null,
                    tags: [],
                    details: {},
                    status: CatalogStatus.Published,
                    createdAt: DATE,
                    updatedAt: DATE,
                    position: i,
                    isOptional: optional ?? false,
                    progress: ProgressStatus.NotStarted,
                    ...item,
                } ) );

                return {
                    ...node( topic.id, topic.title, t ),
                    description: topic.description ?? null,
                    moduleId: uuid( 700 + m ),
                    progress: count( items ),
                    items,
                };
            } );

            return {
                ...node( uuid( 700 + m ), module.title, m ),
                description: module.description ?? null,
                learningPathId: base.learningPath.id,
                progress: count( topics.flatMap( ( topic ) => topic.items ) ),
                topics,
            };
        } ),
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

/** A path in the catalog: official, with nothing in it, not enrolled, unless `overrides` say otherwise. */
export function catalogPath(
    title: string,
    overrides: Partial<PublishedPathSummaryJson> = {},
): PublishedPathSummaryJson {
    return {
        ...node( overrides.id ?? uuid( 300 + title.length ), title, 0 ),
        description: null,
        organizationId: null,
        visibility: PathVisibility.Public,
        publicBlockedAt: null,
        organization: null,
        createdBy: null,
        enrollmentId: null,
        contents: { modules: 0, items: 0, estimatedMinutes: 0 },
        ...overrides,
    };
}

/** The user's personal workspace, or (with overrides) an organization they're in. */
export function organization( overrides: Partial<MyOrganizationJson> = {} ): MyOrganizationJson {
    return {
        id: uuid( 4 ),
        name: 'Sam\'s Workspace',
        slug: 'sams-workspace',
        isPersonal: true,
        role: OrganizationRole.Owner,
        createdAt: DATE,
        updatedAt: DATE,
        ...overrides,
    };
}

/** An item in the catalog: an official problem unless `overrides` say otherwise. */
export function catalogItem( id: string, title: string, overrides: Partial<CatalogItemJson> = {} ): CatalogItemJson {
    return {
        id,
        organizationId: null,
        type: ItemType.Problem,
        title,
        description: null,
        difficulty: null,
        estimatedMinutes: null,
        tags: [],
        details: {},
        status: CatalogStatus.Published,
        createdAt: DATE,
        updatedAt: DATE,
        ...overrides,
    };
}

export interface BuilderModuleSpec {
    title: string;
    topics: { title: string; items: ( CatalogItemJson & { isOptional?: boolean } )[] }[];
}

/**
 * A path as the builder loads it, in the personal workspace (uuid( 4 )). Ids: path uuid( 400 ), module m uuid( 500 + m ),
 * topic t of module m uuid( 600 + 10 * m + t ).
 */
export function pathTree(
    title: string,
    modules: BuilderModuleSpec[],
    overrides: Partial<Omit<LearningPathTreeJson, 'modules'>> = {},
): LearningPathTreeJson {
    const id = overrides.id ?? uuid( 400 );

    return {
        ...node( id, title, 0 ),
        organizationId: uuid( 4 ),
        visibility: PathVisibility.Private,
        publicBlockedAt: null,
        ...overrides,
        modules: modules.map( ( module, m ) => ( {
            ...node( uuid( 500 + m ), module.title, m ),
            learningPathId: id,
            topics: module.topics.map( ( topic, t ) => ( {
                ...node( uuid( 600 + 10 * m + t ), topic.title, t ),
                moduleId: uuid( 500 + m ),
                items: topic.items.map( ( { isOptional = false, ...item }, i ) => (
                    { ...item, position: i, isOptional }
                ) ),
            } ) ),
        } ) ),
    };
}
