/*
 * How the app shows numbers and dates. The app is in English, so formats are fixed to en-US; times are in the
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

const weekday = new Intl.DateTimeFormat( 'en-US', { weekday: 'long' } );
const dayMonth = new Intl.DateTimeFormat( 'en-GB', { day: 'numeric', month: 'long' } );

/** Today's date above a page title: "Monday, 19 October". */
export function formatLongDate( date: Date ): string {
    return `${weekday.format( date )}, ${dayMonth.format( date )}`;
}

/** When a session started: "Today, 9:30 AM", "Yesterday, 6:00 PM" or "Mon, Sep 22, 8:15 AM". */
export function formatSessionStart( startedAt: Date, now: Date ): string {
    return `${relativeDay( startedAt, now )}, ${formatTime( startedAt )}`;
}

/** "9:30 AM". */
export function formatTime( date: Date ): string {
    return time.format( date );
}

/** The local day of `date`: "Today", "Yesterday" or "Mon, Sep 22". */
export function relativeDay( date: Date, now: Date ): string {
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

const monthYear = new Intl.DateTimeFormat( 'en-US', { month: 'short', year: 'numeric' } );

/** A moment's month: "Oct 2026". */
export function formatMonth( iso: string ): string {
    return monthYear.format( new Date( iso ) );
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

/** What a session was about: the item, with its topic as context, or just the topic. Either may be missing. */
export function describeSession( session: {
    topic: { title: string } | null;
    item: { title: string } | null;
} ): { title: string; context: string | undefined } {
    const { topic, item } = session;

    if ( item ) {
        return { title: item.title, context: topic?.title };
    }

    return { title: topic?.title ?? 'Study session', context: undefined };
}

const pad = ( value: number ) => String( value ).padStart( 2, '0' );

/** The local date as `<input type="date">` wants it: "2026-09-29". Also a key to group by local day. */
export function toDateInput( date: Date ): string {
    return `${date.getFullYear()}-${pad( date.getMonth() + 1 )}-${pad( date.getDate() )}`;
}

/** The local time as `<input type="time">` wants it: "09:05". */
export function toTimeInput( date: Date ): string {
    return `${pad( date.getHours() )}:${pad( date.getMinutes() )}`;
}

/** A local date and time from those inputs, or undefined if either is missing or not valid. */
export function fromDateTimeInputs( date: string, time: string ): Date | undefined {
    // Anything but "YYYY-MM-DD" and "HH:MM" (what the inputs give) makes an invalid date.
    const value = new Date( `${date}T${time}` );

    return Number.isNaN( value.getTime() ) ? undefined : value;
}
