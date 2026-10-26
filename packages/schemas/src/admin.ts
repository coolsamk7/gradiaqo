import type { StaticDecode, StaticEncode } from 'typebox';
import Type from 'typebox';

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
