import type { ForcedSubject, InferSubjects, MongoAbility } from '@casl/ability';
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import type { Item, LearningModule, LearningPath, Membership, Organization, Topic, User } from '@studylog/database';
import { OrganizationRole, PlatformRole } from '@studylog/database';

export type Action = 'manage' | 'create' | 'read' | 'update' | 'delete';

export type SubjectType =
    | 'User'
    | 'Organization'
    | 'Membership'
    // The learning catalog: the global one is managed by superadmins (via `manage all`), an organization's own
    // by its owners and admins.
    | 'LearningPath'
    | 'LearningModule'
    | 'Topic'
    | 'Item'
    // Reports on public paths. Only superadmins moderate (via `manage all`).
    | 'PathReport'
    | 'all';

// Entity instances (detected by class name) or plain objects tagged with `subject( 'Organization', obj )`.
type Subjects =
    | InferSubjects<
        typeof User | typeof Organization | typeof Membership | typeof LearningPath | typeof LearningModule
        | typeof Topic | typeof Item
    >
    | ( ForcedSubject<Exclude<SubjectType, 'all'>> & Record<string, unknown> )
    | SubjectType;

export type AppAbility = MongoAbility<[ Action, Subjects ]>;

export interface AbilityContext {
    userId: string;
    platformRole: PlatformRole;
    /** The user's membership in the organization the request is about, if any. */
    membership?: Pick<Membership, 'organizationId' | 'role'> | null;
}

/**
 * Every permission in StudyLog, in one place.
 *
 * Conditions (e.g. `{ id: orgId }`) are checked against the actual record, so route-level
 * checks answer "can this user ever do X to a Y?" and services check the specific record:
 * `ability.can( 'update', organization )`.
 */
export function defineAbilityFor( { userId, platformRole, membership }: AbilityContext ): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>( createMongoAbility );

    if ( platformRole === PlatformRole.Superadmin ) {
        can( 'manage', 'all' );
    }

    can( [ 'read', 'update' ], 'User', { id: userId } );

    if ( membership ) {
        const { organizationId, role } = membership;
        // Modules and topics have no organizationId of their own: routes check them by type, and the catalog
        // services only ever load them through a path of the organization.
        const catalog: SubjectType[] = [ 'LearningPath', 'LearningModule', 'Topic', 'Item' ];

        switch ( role ) {
            case OrganizationRole.Owner:
                can( 'manage', 'Organization', { id: organizationId } );
                can( 'manage', 'Membership', { organizationId } );
                can( 'manage', catalog, { organizationId } );
                break;

            case OrganizationRole.Admin:
                can( [ 'read', 'update' ], 'Organization', { id: organizationId } );
                can( 'manage', 'Membership', { organizationId } );
                // Admins manage members and other admins, never the owner.
                cannot( [ 'update', 'delete' ], 'Membership', { role: OrganizationRole.Owner } );
                can( 'manage', catalog, { organizationId } );
                break;

            case OrganizationRole.Member:
                can( 'read', 'Organization', { id: organizationId } );
                can( 'read', 'Membership', { organizationId } );
                can( 'read', catalog, { organizationId } );
                break;
        }
    }

    // A personal workspace lives and dies with its user account, for everyone.
    cannot( 'delete', 'Organization', { isPersonal: true } );

    return build();
}
