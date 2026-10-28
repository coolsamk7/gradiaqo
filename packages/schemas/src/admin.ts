import type { StaticDecode, StaticEncode } from 'typebox';
import Type from 'typebox';

import { AuditAction } from './enums.js';
import { IsoDate, Uuid } from './primitives.js';

/* Admin › Overview: the platform at a glance, for superadmins. "Last 30 days" counts from now; days are UTC. */

const Count = ( description?: string ) => Type.Integer( { minimum: 0, ...( description ? { description } : {} ) } );

export const PlatformOverview = Type.Object( {
    users: Type.Object( {
        total: Count(),
        verified: Count( 'Confirmed their email' ),
        superadmins: Count(),
    } ),
    activeUsers: Type.Object( {
        last7Days: Count( 'Logged in or renewed their session in the last 7 days' ),
        last30Days: Count(),
    } ),
    signups: Type.Object( {
        last30Days: Count(),
        perDay: Type.Array(
            Type.Object( { date: Type.String( { format: 'date', examples: [ '2026-10-26' ] } ), count: Count() } ),
            { description: 'The last 30 days, oldest first; the last one is today (UTC)' },
        ),
    } ),
    study: Type.Object( {
        learners: Count( 'Users who logged a study session in the last 30 days' ),
        sessions: Count(),
        minutes: Count(),
    } ),
    topPaths: Type.Array(
        Type.Object( {
            id: Uuid(),
            title: Type.String(),
            official: Type.Boolean( { description: 'In the global catalog, not shared by a user' } ),
            enrollments: Count(),
        } ),
        { description: 'The 5 paths with the most enrollments' },
    ),
} );
export type PlatformOverview = StaticDecode<typeof PlatformOverview>;
export type PlatformOverviewJson = StaticEncode<typeof PlatformOverview>;

// ---------- Admin › Organizations ----------

const Person = Type.Object( { id: Uuid(), firstName: Type.String(), lastName: Type.String(), email: Type.String() } );

/** An organization as superadmins see it in the list: its size, its owners, and whether it's a personal workspace. */
export const AdminOrganization = Type.Object( {
    id: Uuid(),
    name: Type.String(),
    isPersonal: Type.Boolean( { description: 'The workspace created automatically at signup' } ),
    createdAt: IsoDate(),
    memberCount: Count(),
    pathCount: Count( 'Its own paths, in any status and visibility' ),
    owners: Type.Array( Person ),
} );
export type AdminOrganization = StaticDecode<typeof AdminOrganization>;
export type AdminOrganizationJson = StaticEncode<typeof AdminOrganization>;

export const ListOrganizationsQuery = Type.Object(
    {
        search: Type.Optional( Type.String( { minLength: 1, maxLength: 255, description: 'Part of the name, or of a member\'s email' } ) ),
        personal: Type.Optional( Type.Boolean( { description: 'Include personal workspaces (default: false)' } ) ),
        limit: Type.Optional( Type.Integer( { minimum: 1, maximum: 200, default: 50 } ) ),
        offset: Type.Optional( Type.Integer( { minimum: 0, default: 0 } ) ),
    },
    { additionalProperties: false },
);
export type ListOrganizationsQuery = StaticDecode<typeof ListOrganizationsQuery>;

export const AdminOrganizationPage = Type.Object( { items: Type.Array( AdminOrganization ), total: Count() } );
export type AdminOrganizationPage = StaticDecode<typeof AdminOrganizationPage>;
export type AdminOrganizationPageJson = StaticEncode<typeof AdminOrganizationPage>;

// ---------- Admin › Audit log ----------

/** The parts of Admin that record to the audit log. */
export enum AuditArea {
    Users = 'users',
    Catalog = 'catalog',
    Moderation = 'moderation',
}

/** Which actions belong to each area. */
export const AUDIT_AREAS: Record<AuditArea, AuditAction[]> = {
    [AuditArea.Users]: [ AuditAction.UserPromoted, AuditAction.UserDemoted, AuditAction.UserRemoved ],
    [AuditArea.Catalog]: [
        AuditAction.PathPublished,
        AuditAction.PathMovedToDraft,
        AuditAction.PathArchived,
        AuditAction.PathDeleted,
        AuditAction.PathImported,
        AuditAction.ItemPublished,
        AuditAction.ItemMovedToDraft,
        AuditAction.ItemArchived,
        AuditAction.ItemDeleted,
    ],
    [AuditArea.Moderation]: [ AuditAction.ReportDismissed, AuditAction.PathHidden, AuditAction.PathUnhidden ],
};

export const AuditEvent = Type.Object( {
    id: Uuid(),
    action: Type.Enum( AuditAction ),
    actor: Type.Object( {
        id: Type.Union( [ Uuid(), Type.Null() ], { description: 'Null once their account is deleted' } ),
        name: Type.String( { description: 'Their name at the time' } ),
    } ),
    targetId: Uuid(),
    targetLabel: Type.String( { description: 'The user\'s email or the path\'s or item\'s title at the time' } ),
    note: Type.Union( [ Type.String(), Type.Null() ] ),
    createdAt: IsoDate(),
} );
export type AuditEvent = StaticDecode<typeof AuditEvent>;
export type AuditEventJson = StaticEncode<typeof AuditEvent>;

export const ListAuditQuery = Type.Object(
    {
        area: Type.Optional( Type.Enum( AuditArea ) ),
        limit: Type.Optional( Type.Integer( { minimum: 1, maximum: 200, default: 50 } ) ),
        offset: Type.Optional( Type.Integer( { minimum: 0, default: 0 } ) ),
    },
    { additionalProperties: false },
);
export type ListAuditQuery = StaticDecode<typeof ListAuditQuery>;

export const AuditPage = Type.Object( { items: Type.Array( AuditEvent ), total: Count() } );
export type AuditPage = StaticDecode<typeof AuditPage>;
export type AuditPageJson = StaticEncode<typeof AuditPage>;
