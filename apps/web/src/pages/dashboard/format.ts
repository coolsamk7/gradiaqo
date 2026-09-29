/*
 * How the dashboard shows numbers and dates. The app is in English, so formats are fixed to en-US; times are in the
 * browser's time zone, like the stats the API computes for it.
 */

/** 0 → "0m", 45 → "45m", 60 → "1h", 95 → "1h 35m". */
export function formatMinutes( minutes: number ): string {
    const hours = Math.floor( minutes / 60 );
    const rest = minutes % 60;

    if ( hours === 0 ) {
        return `${rest}m`;
    }

    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** 1 → "1 day", 3 → "3 days". */
export function formatDays( days: number ): string {
    return days === 1 ? '1 day' : `${days} days`;
}

/** Share of `total` done, as a whole percentage (0 when there is nothing to do). */
export function percent( completed: number, total: number ): number {
    return total === 0 ? 0 : Math.round( ( completed / total ) * 100 );
}

const time = new Intl.DateTimeFormat( 'en-US', { hour: 'numeric', minute: '2-digit' } );
const weekdayDate = new Intl.DateTimeFormat( 'en-US', { weekday: 'short', month: 'short', day: 'numeric' } );
const shortDate = new Intl.DateTimeFormat( 'en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' } );

/** When a session started: "Today, 9:30 AM", "Yesterday, 6:00 PM" or "Mon, Sep 22, 8:15 AM". */
export function formatSessionStart( startedAt: Date, now: Date ): string {
    return `${relativeDay( startedAt, now )}, ${time.format( startedAt )}`;
}

function relativeDay( date: Date, now: Date ): string {
    const daysAgo = localDayNumber( now ) - localDayNumber( date );

    if ( daysAgo === 0 ) {
        return 'Today';
    }

    return daysAgo === 1 ? 'Yesterday' : weekdayDate.format( date );
}

/** A calendar date from the stats ("2026-09-25", already in the user's time zone) as "Sep 25". */
export function formatStatsDate( date: string ): string {
    return shortDate.format( new Date( `${date}T00:00:00Z` ) );
}

/** "Good morning" before noon, "Good afternoon" before 6 PM, then "Good evening" (local time). */
export function greeting( now: Date ): string {
    const hour = now.getHours();

    if ( hour < 12 ) {
        return 'Good morning';
    }

    return hour < 18 ? 'Good afternoon' : 'Good evening';
}

/** Days since the epoch for the local calendar date, so two dates can be compared by day. */
function localDayNumber( date: Date ): number {
    return Math.floor( Date.UTC( date.getFullYear(), date.getMonth(), date.getDate() ) / 86_400_000 );
}
