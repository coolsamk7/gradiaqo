import type { PlatformOverviewJson } from '@studylog/schemas';

import type { StatTile } from '../../components/StatTiles.tsx';
import { formatMinutes } from '../../format/format.ts';

/* Numbers and words for Admin › Overview. */

const plural = ( count: number, one: string, many = `${one}s` ) => `${count} ${count === 1 ? one : many}`;

/** Users, active users, new sign-ups and study, as stat tiles. */
export function overviewTiles( { users, activeUsers, signups, study }: PlatformOverviewJson ): StatTile[] {
    return [
        { label: 'Users', value: String( users.total ), detail: `${users.verified} verified · ${plural( users.superadmins, 'superadmin' )}`, icon: 'users' },
        { label: 'Active this week', value: String( activeUsers.last7Days ), detail: `${activeUsers.last30Days} in 30 days`, icon: 'zap' },
        { label: 'New sign-ups', value: String( signups.last30Days ), detail: 'In the last 30 days', icon: 'user' },
        {
            label: 'Studying',
            value: String( study.learners ),
            detail: `${plural( study.sessions, 'session' )} · ${formatMinutes( study.minutes )}`,
            icon: 'clock',
        },
    ];
}

/** "6 sign-ups, the most on Sep 28 (5).", or that there were none. */
export function signupSummary( days: PlatformOverviewJson['signups']['perDay'] ): string {
    const total = days.reduce( ( sum, day ) => sum + day.count, 0 );

    if ( total === 0 ) {
        return 'No sign-ups in the last 30 days.';
    }

    const best = days.reduce( ( most, day ) => ( day.count > most.count ? day : most ) );
    const date = new Date( `${best.date}T00:00:00Z` ).toLocaleDateString( 'en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' } );

    return `${plural( total, 'sign-up' )}, the most on ${date} (${best.count}).`;
}
