/*
 * Calendar-day helpers on "YYYY-MM-DD" strings. Days are computed with UTC arithmetic on the date alone, so
 * daylight saving changes can't shift them.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** The calendar date of `instant` in `timeZone`, e.g. "2026-09-25". */
export function toLocalDate( instant: Date, timeZone: string ): string {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat( 'en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' } ).format( instant );
}

export function addDays( day: string, days: number ): string {
    return new Date( Date.parse( `${day}T00:00:00Z` ) + days * DAY_MS ).toISOString().slice( 0, 10 );
}

/** Monday of the week containing `day`. */
export function startOfWeek( day: string ): string {
    const weekday = new Date( `${day}T00:00:00Z` ).getUTCDay(); // 0 = Sunday

    return addDays( day, -( ( weekday + 6 ) % 7 ) );
}

/** The `count` days ending with `today`, oldest first. */
export function lastDays( today: string, count: number ): string[] {
    return Array.from( { length: count }, ( _, index ) => addDays( today, index - count + 1 ) );
}

/**
 * Streaks of consecutive study days. The current streak ends today, or yesterday if the user hasn't studied
 * yet today (the streak isn't broken until the day is over).
 */
export function computeStreaks( studyDays: string[], today: string ): { current: number; longest: number } {
    const days = new Set( studyDays );
    const sorted = [ ...days ].sort();
    let longest = 0;
    let run = 0;
    let previous: string | undefined;

    for ( const day of sorted ) {
        run = previous && addDays( previous, 1 ) === day ? run + 1 : 1;
        longest = Math.max( longest, run );
        previous = day;
    }

    let current = 0;
    let cursor = days.has( today ) ? today : addDays( today, -1 );

    while ( days.has( cursor ) ) {
        current++;
        cursor = addDays( cursor, -1 );
    }

    return { current, longest };
}
