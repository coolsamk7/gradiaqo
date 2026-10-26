import type { StaticDecode, StaticEncode } from 'typebox';
import Type from 'typebox';

import { Uuid } from './primitives.js';

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
