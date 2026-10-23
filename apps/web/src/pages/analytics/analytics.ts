import type { AnalyticsJson, AnalyticsPeriod } from '@studylog/schemas';

import { formatMinutes, formatStatsDate, percent } from '../../format/format.ts';

/** The period buttons, in order. The first is the default (no `?period=` in the URL). */
export const PERIODS: { period: AnalyticsPeriod; label: string }[] = [
    { period: '30d', label: 'Last 30 days' },
    { period: '90d', label: '90 days' },
    { period: 'all', label: 'All time' },
];

export function isPeriod( value: string | null ): value is AnalyticsPeriod {
    return PERIODS.some( ( option ) => option.period === value );
}

/** The period as a card subtitle: "Last 30 days", "Last 90 days" or "All time". */
export function periodLabel( period: AnalyticsPeriod ): string {
    return period === 'all' ? 'All time' : `Last ${period === '30d' ? 30 : 90} days`;
}

/** Time studied against the period before: "+3h 10m vs the 30 days before", "Same as …", or "All time". */
export function versusBefore( totals: AnalyticsJson['totals'], period: AnalyticsPeriod ): string {
    if ( totals.previousMinutes === null ) {
        return 'All time';
    }

    const before = `the ${period === '30d' ? 30 : 90} days before`;
    const difference = totals.minutes - totals.previousMinutes;

    if ( difference === 0 ) {
        return `Same as ${before}`;
    }

    return `${difference > 0 ? '+' : '−'}${formatMinutes( Math.abs( difference ) )} vs ${before}`;
}

/**
 * Which weeks get a date under their bar: about four spread evenly, always including the current (last) one, so
 * labels don't crowd however many weeks there are.
 */
export function labelledWeeks( count: number ): Set<number> {
    const step = Math.max( 1, Math.ceil( count / 4 ) );
    const labelled = new Set<number>( [ count - 1 ] );

    for ( let index = 0; index < count - 1; index += step ) {
        // Skip one right before the last label, where the two would touch.
        if ( count - 1 - index >= Math.ceil( step / 2 ) ) {
            labelled.add( index );
        }
    }

    return labelled;
}

/** "Sep 14" for a week starting on that Monday. */
export function weekLabel( weekStart: string ): string {
    return formatStatsDate( weekStart );
}

/** A 3-hour window of the day: { from: 18, to: 21 } → "6–9 PM", { from: 10, to: 13 } → "10 AM–1 PM". */
export function formatHours( hours: { from: number; to: number } ): string {
    const from = hourOf( hours.from );
    const to = hourOf( hours.to );

    return from.half === to.half ? `${from.hour}–${to.hour} ${to.half}` : `${from.hour} ${from.half}–${to.hour} ${to.half}`;
}

function hourOf( hour: number ): { hour: number; half: 'AM' | 'PM' } {
    const half = hour % 24 < 12 ? 'AM' : 'PM';

    return { hour: hour % 12 === 0 ? 12 : hour % 12, half };
}

type Focus = AnalyticsJson['focus'][number];

/** How a topic that needs focus is doing: "2 items to revise · last studied 9 days ago". */
export function focusSummary( topic: Focus, today: string ): string {
    const parts = [ progressOf( topic ) ];

    if ( topic.lastStudiedOn ) {
        parts.push( `last studied ${daysAgo( topic.lastStudiedOn, today )}` );
    }

    return parts.join( ' · ' );
}

function progressOf( topic: Focus ): string {
    if ( topic.toRevise > 0 ) {
        return `${topic.toRevise} ${topic.toRevise === 1 ? 'item' : 'items'} to revise`;
    }

    return topic.completed === 0
        ? `Not started · ${topic.total} required ${topic.total === 1 ? 'item' : 'items'}`
        : `${topic.completed} of ${topic.total} done`;
}

/** "today", "yesterday", "9 days ago" or "3 weeks ago", between two calendar dates. */
export function daysAgo( date: string, today: string ): string {
    const days = Math.round( ( Date.parse( today ) - Date.parse( date ) ) / 86_400_000 );

    if ( days <= 0 ) {
        return 'today';
    }
    if ( days === 1 ) {
        return 'yesterday';
    }

    return days < 21 ? `${days} days ago` : `${Math.floor( days / 7 )} weeks ago`;
}

/** Red for nothing done yet, amber for some, green when (nearly) all of it is done. */
export function toneOf( share: number ): 'danger' | 'warning' | 'success' {
    if ( share === 0 ) {
        return 'danger';
    }

    return share >= 80 ? 'success' : 'warning';
}

/** Share of items done, counting those marked for revision (they were finished once). */
export function doneShare( status: AnalyticsJson['itemStatus'] ): number {
    const total = status.done + status.revise + status.inProgress + status.notStarted;

    return percent( status.done + status.revise, total );
}
