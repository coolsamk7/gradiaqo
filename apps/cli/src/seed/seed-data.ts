import { randomUUID } from 'node:crypto';

import {
    CatalogStatus,
    Enrollment,
    EnrollmentOrder,
    EnrollmentRule,
    Item,
    ItemProgress,
    LearningModule,
    LearningPath,
    Membership,
    OrderParentType,
    Organization,
    OrganizationInvitation,
    OrganizationRole,
    PathReport,
    ProgressStatus,
    ReportStatus,
    RuleMode,
    RuleScope,
    StudySession,
    Topic,
    TopicItem,
    User,
} from '@studylog/database';
import type { EntityTarget, ObjectLiteral, QueryDeepPartialEntity } from 'typeorm';

import type { CatalogOwner, ItemKey, ItemSpec, PathKey, PathSpec, UserKey } from './seed-content.js';
import { ACTIVITY, ENROLLMENTS, ITEMS, PATHS, REPORTS, TEAM, USERS } from './seed-content.js';
import { toSlug } from './slug.js';

type Rows<T> = Partial<T>[];

/** Every row to insert, per table. */
export interface SeedData {
    users: Rows<User>;
    organizations: Rows<Organization>;
    memberships: Rows<Membership>;
    invitations: Rows<OrganizationInvitation>;
    items: Rows<Item>;
    paths: Rows<LearningPath>;
    modules: Rows<LearningModule>;
    topics: Rows<Topic>;
    topicItems: Rows<TopicItem>;
    enrollments: Rows<Enrollment>;
    enrollmentRules: Rows<EnrollmentRule>;
    enrollmentOrders: Rows<EnrollmentOrder>;
    progress: Rows<ItemProgress>;
    studySessions: Rows<StudySession>;
    reports: Rows<PathReport>;
}

export interface SeedOptions {
    /** Dates are relative to it: the data always looks recent. */
    now: Date;
    /** Hash of `SEED_PASSWORD`, shared by every user. */
    passwordHash: string;
    id?: () => string;
    /** Seed for the made-up study activity, so every run looks the same. */
    randomSeed?: number;
}

/** One enrollable item: where it sits in its path. */
interface PathEntry {
    moduleTitle: string;
    topicId: string;
    itemId: string;
}

interface StartedEntry extends PathEntry {
    startedDaysAgo: number;
}

/** Builds the dummy data: users, organizations, catalog, enrollments, progress, study sessions and reports. */
export function buildSeedData( { now, passwordHash, id = randomUUID, randomSeed = 42 }: SeedOptions ): SeedData {
    const random = seededRandom( randomSeed );
    const midnight = Date.UTC( now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() );
    /** That many days before today (negative: in the future), at that time of day (UTC). */
    const daysAgo = ( days: number, hour = 9, minute = 0 ) =>
        new Date( midnight + ( ( hour - days * 24 ) * 60 + minute ) * 60_000 );

    const data: SeedData = {
        users: [],
        organizations: [],
        memberships: [],
        invitations: [],
        items: [],
        paths: [],
        modules: [],
        topics: [],
        topicItems: [],
        enrollments: [],
        enrollmentRules: [],
        enrollmentOrders: [],
        progress: [],
        studySessions: [],
        reports: [],
    };

    // ---------- Users, each with a personal workspace ----------

    const userIds = {} as Record<UserKey, string>;
    const personalOrganizationIds = {} as Record<UserKey, string>;

    for ( const user of USERS ) {
        const joined = daysAgo( user.joinedDaysAgo );
        const userId = id();
        const organizationId = id();

        userIds[user.key] = userId;
        personalOrganizationIds[user.key] = organizationId;
        data.users.push( {
            id: userId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            passwordHash,
            platformRole: user.platformRole,
            createdAt: joined,
            updatedAt: joined,
        } );
        data.organizations.push( {
            id: organizationId,
            name: `${user.firstName}'s Workspace`,
            slug: toSlug( `${user.firstName}'s Workspace` ),
            isPersonal: true,
            createdById: userId,
            createdAt: joined,
            updatedAt: joined,
        } );
        data.memberships.push( {
            id: id(),
            userId,
            organizationId,
            role: OrganizationRole.Owner,
            createdAt: joined,
            updatedAt: joined,
        } );
    }

    // ---------- The shared organization ----------

    const teamId = id();
    const teamCreated = daysAgo( 28 );

    data.organizations.push( {
        id: teamId,
        name: TEAM.name,
        slug: TEAM.slug,
        isPersonal: false,
        createdById: userIds[TEAM.createdBy],
        createdAt: teamCreated,
        updatedAt: teamCreated,
    } );
    for ( const member of TEAM.members ) {
        data.memberships.push( {
            id: id(),
            userId: userIds[member.user],
            organizationId: teamId,
            role: member.role,
            createdAt: teamCreated,
            updatedAt: teamCreated,
        } );
    }
    for ( const invitation of TEAM.invitations ) {
        data.invitations.push( {
            id: id(),
            organizationId: teamId,
            email: invitation.email,
            role: invitation.role,
            invitedById: userIds[TEAM.createdBy],
            createdAt: daysAgo( 2 ),
            expiresAt: daysAgo( -5 ),
        } );
    }

    const catalogOrganizationIds: Record<CatalogOwner, string | null> = {
        global: null,
        team: teamId,
        alice: personalOrganizationIds.alice,
    };

    // ---------- Catalog: items, then paths → modules → topics → linked items ----------

    const itemIds = {} as Record<ItemKey, string>;

    for ( const [ key, item ] of Object.entries( ITEMS ) as [ ItemKey, ItemSpec ][] ) {
        const created = daysAgo( 80 );

        itemIds[key] = id();
        data.items.push( {
            id: itemIds[key],
            organizationId: catalogOrganizationIds[item.owner],
            type: item.type,
            title: item.title,
            description: null,
            difficulty: item.difficulty ?? null,
            estimatedMinutes: item.estimatedMinutes,
            tags: item.tags ?? [],
            details: item.details,
            status: item.status ?? CatalogStatus.Published,
            createdById: userIds[item.owner === 'global' ? 'admin' : 'alice'],
            createdAt: created,
            updatedAt: created,
        } );
    }

    const pathSpecs = Object.fromEntries( PATHS.map( ( path ) => [ path.key, path ] ) ) as Record<PathKey, PathSpec>;
    const pathIds = {} as Record<PathKey, string>;
    const pathEntries = {} as Record<PathKey, PathEntry[]>;
    const moduleIds: Record<string, string> = {}; // "<path>/<module title>"
    const topicIds: Record<string, string> = {}; // "<path>/<module title>/<topic title>"

    PATHS.forEach( ( path, pathPosition ) => {
        const created = daysAgo( 75 );
        const pathId = id();

        pathIds[path.key] = pathId;
        pathEntries[path.key] = [];
        data.paths.push( {
            id: pathId,
            organizationId: catalogOrganizationIds[path.owner],
            title: path.title,
            slug: toSlug( path.title ),
            description: path.description,
            status: path.status,
            visibility: path.visibility,
            publicBlockedAt: null,
            position: pathPosition,
            createdById: userIds[path.createdBy],
            createdAt: created,
            updatedAt: created,
        } );

        path.modules.forEach( ( module, modulePosition ) => {
            const moduleId = id();

            moduleIds[`${path.key}/${module.title}`] = moduleId;
            data.modules.push( {
                id: moduleId,
                learningPathId: pathId,
                title: module.title,
                slug: toSlug( module.title ),
                description: module.description ?? null,
                status: path.status,
                position: modulePosition,
                createdAt: created,
                updatedAt: created,
            } );

            module.topics.forEach( ( topic, topicPosition ) => {
                const topicId = id();

                topicIds[`${path.key}/${module.title}/${topic.title}`] = topicId;
                data.topics.push( {
                    id: topicId,
                    moduleId,
                    title: topic.title,
                    slug: toSlug( topic.title ),
                    description: topic.description ?? null,
                    status: path.status,
                    position: topicPosition,
                    createdAt: created,
                    updatedAt: created,
                } );
                topic.items.forEach( ( key, itemPosition ) => {
                    const isOptional = topic.optional?.includes( key ) ?? false;

                    data.topicItems.push( {
                        topicId,
                        itemId: itemIds[key],
                        position: itemPosition,
                        isOptional,
                        createdAt: created,
                    } );
                    if ( !isOptional ) {
                        pathEntries[path.key].push( { moduleTitle: module.title, topicId, itemId: itemIds[key] } );
                    }
                } );
            } );
        } );
    } );

    // ---------- Enrollments, with each user's progress ----------

    /** Items each user has started, with a topic to log study time against. */
    const studied = Object.fromEntries( USERS.map( ( user ) => [ user.key, [] as StartedEntry[] ] ) ) as
        Record<UserKey, StartedEntry[]>;
    const progressKeys = new Set<string>();

    ENROLLMENTS.forEach( ( enrollment, position ) => {
        const userId = userIds[enrollment.user];
        const enrollmentId = id();
        const enrolledDaysAgo = 30 - position;
        const started = daysAgo( enrolledDaysAgo );
        const excluded = enrollment.excludeModules ?? [];
        const entries = pathEntries[enrollment.path].filter( ( entry ) => !excluded.includes( entry.moduleTitle ) );
        const firstModule = pathSpecs[enrollment.path].modules[0];

        data.enrollments.push( {
            id: enrollmentId,
            userId,
            learningPathId: pathIds[enrollment.path],
            status: enrollment.status,
            position,
            createdAt: started,
            updatedAt: started,
        } );
        for ( const title of excluded ) {
            data.enrollmentRules.push( {
                enrollmentId,
                scope: RuleScope.Module,
                scopeId: moduleIds[`${enrollment.path}/${title}`],
                mode: RuleMode.Exclude,
            } );
        }
        if ( enrollment.firstModuleOrder ) {
            data.enrollmentOrders.push( {
                enrollmentId,
                parentType: OrderParentType.Module,
                parentId: moduleIds[`${enrollment.path}/${firstModule.title}`],
                orderedIds: enrollment.firstModuleOrder.map( ( title ) => topicIds[`${enrollment.path}/${firstModule.title}/${title}`] ),
            } );
        }

        // The first items are done (every fifth one marked for revision), the next two in progress. One item
        // started a day, from the day after enrolling.
        const doneCount = Math.round( entries.length * enrollment.done );

        entries.slice( 0, doneCount + 2 ).forEach( ( entry, index ) => {
            const key = `${userId}/${entry.itemId}`;

            if ( progressKeys.has( key ) ) {
                return; // Progress is per item: already counted through another path.
            }
            progressKeys.add( key );

            const isDone = index < doneCount;
            const startedDaysAgo = Math.max( 1, enrolledDaysAgo - 1 - index );
            const startedAt = daysAgo( startedDaysAgo, 18 );
            const completedAt = isDone ? daysAgo( Math.max( 1, startedDaysAgo - 1 ), 20 ) : null;

            data.progress.push( {
                userId,
                itemId: entry.itemId,
                status: isDone ? doneStatus( index ) : ProgressStatus.InProgress,
                startedAt,
                completedAt,
                updatedAt: completedAt ?? startedAt,
            } );
            studied[enrollment.user].push( { ...entry, startedDaysAgo } );
        } );
    } );

    // ---------- Study sessions over the last 30 days ----------

    const durations = [ 20, 25, 30, 45, 60, 90 ];
    const notes = [ null, null, null, 'Got stuck on the edge cases.', 'Finally clicked!', 'Need to revisit this one.' ];

    for ( const [ user, activity ] of Object.entries( ACTIVITY ) as [ UserKey, number ][] ) {
        for ( let day = 30; day >= 1; day-- ) {
            // Only items started on an earlier day.
            const entries = studied[user].filter( ( entry ) => entry.startedDaysAgo > day );

            if ( entries.length === 0 || random() >= activity ) {
                continue;
            }

            const sessions = random() < 0.3 ? 2 : 1;

            for ( let session = 0; session < sessions; session++ ) {
                const entry = pick( entries, random );
                const hour = 8 + session * 6 + Math.floor( random() * 5 );
                const startedAt = daysAgo( day, hour, Math.floor( random() * 4 ) * 15 );
                const durationMinutes = pick( durations, random );
                const ended = new Date( startedAt.getTime() + durationMinutes * 60_000 );

                data.studySessions.push( {
                    id: id(),
                    userId: userIds[user],
                    topicId: entry.topicId,
                    itemId: entry.itemId,
                    startedAt,
                    durationMinutes,
                    notes: pick( notes, random ),
                    createdAt: ended,
                    updatedAt: ended,
                } );
            }
        }
    }

    // ---------- Moderation reports ----------

    REPORTS.forEach( ( report, index ) => {
        const isResolved = report.status !== ReportStatus.Open;

        data.reports.push( {
            id: id(),
            learningPathId: pathIds[report.path],
            reporterId: userIds[report.reporter],
            reason: report.reason,
            details: report.details,
            status: report.status,
            resolvedById: isResolved ? userIds.admin : null,
            resolvedAt: isResolved ? daysAgo( 4 ) : null,
            resolutionNote: report.resolutionNote,
            createdAt: daysAgo( 6 - index * 5 ),
        } );
    } );

    return data;
}

export interface SeedTable {
    name: string;
    entity: EntityTarget<ObjectLiteral>;
    rows: QueryDeepPartialEntity<ObjectLiteral>[];
}

/** The tables in insert order: everything a row points at is inserted before it. */
export function seedTables( data: SeedData ): SeedTable[] {
    return [
        { name: 'users', entity: User, rows: data.users },
        { name: 'organizations', entity: Organization, rows: data.organizations },
        { name: 'memberships', entity: Membership, rows: data.memberships },
        { name: 'invitations', entity: OrganizationInvitation, rows: data.invitations },
        { name: 'items', entity: Item, rows: data.items },
        { name: 'learning paths', entity: LearningPath, rows: data.paths },
        { name: 'modules', entity: LearningModule, rows: data.modules },
        { name: 'topics', entity: Topic, rows: data.topics },
        { name: 'topic items', entity: TopicItem, rows: data.topicItems },
        { name: 'enrollments', entity: Enrollment, rows: data.enrollments },
        { name: 'enrollment rules', entity: EnrollmentRule, rows: data.enrollmentRules },
        { name: 'enrollment orders', entity: EnrollmentOrder, rows: data.enrollmentOrders },
        { name: 'item progress', entity: ItemProgress, rows: data.progress },
        { name: 'study sessions', entity: StudySession, rows: data.studySessions },
        { name: 'path reports', entity: PathReport, rows: data.reports },
    ] as SeedTable[];
}

/** A small deterministic random number generator (mulberry32): numbers in [0, 1). */
export function seededRandom( seed: number ): () => number {
    let state = seed;

    return () => {
        state = ( state + 0x6d2b79f5 ) | 0;

        let t = Math.imul( state ^ ( state >>> 15 ), 1 | state );

        t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;

        return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4_294_967_296;
    };
}

/** Every fifth item done is marked for revision. */
function doneStatus( index: number ): ProgressStatus {
    return index % 5 === 4 ? ProgressStatus.Revise : ProgressStatus.Done;
}

function pick<T>( values: readonly T[], random: () => number ): T {
    return values[Math.floor( random() * values.length )];
}
