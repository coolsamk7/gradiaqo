import type { ReportJson } from '@studylog/schemas';
import { PathVisibility, ReportReason, ReportStatus } from '@studylog/schemas/enums';

import { ApiError, NetworkError } from '../../api/client.ts';

/* Labels, dates and messages for the admin's report queue. */

export const REASON_LABELS: Record<ReportReason, string> = {
    [ReportReason.Spam]: 'Spam',
    [ReportReason.Inappropriate]: 'Inappropriate',
    [ReportReason.Copyright]: 'Copyright',
    [ReportReason.Other]: 'Other',
};

type Person = { firstName: string; lastName: string } | null;

const nameOf = ( person: Person, missing: string ) => ( person ? `${person.firstName} ${person.lastName}` : missing );

const DAY = 24 * 60 * 60 * 1000;

/** "today", "yesterday" or "3 days ago". */
export function daysAgo( iso: string, now: Date ): string {
    const days = Math.floor( ( now.getTime() - new Date( iso ).getTime() ) / DAY );

    if ( days <= 0 ) {
        return 'today';
    }

    return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** "Public path by Alice Walker": what was reported. */
export const pathLine = ( report: ReportJson ): string =>
    `${report.learningPath.visibility === PathVisibility.Public ? 'Public' : 'Private'} path by ${nameOf( report.learningPath.createdBy, 'a deleted account' )}`;

export const reporterLine = ( report: ReportJson, now: Date ): string =>
    `Reported by ${nameOf( report.reporter, 'a deleted account' )} · ${daysAgo( report.createdAt, now )}`;

/** "Dismissed by Ada Admin · “A personal selection.”" */
export function resolutionLine( report: ReportJson ): string {
    const what = report.status === ReportStatus.Dismissed ? 'Dismissed' : 'Path hidden';
    const note = report.resolutionNote ? ` · “${report.resolutionNote}”` : '';

    return `${what} by ${nameOf( report.resolvedBy, 'a deleted account' )}${note}`;
}

/** The badge on a resolved report: dismissed, or what became of the path. */
export function outcome( report: ReportJson ): string {
    if ( report.status === ReportStatus.Dismissed ) {
        return 'Dismissed';
    }

    return report.learningPath.publicBlockedAt ? 'Hidden' : 'Un-hidden';
}

const OFFLINE = 'Can\'t reach Gradiaqo right now. Check your connection and try again.';

export function loadError( error: unknown ): string {
    return error instanceof NetworkError ? OFFLINE : 'Something went wrong while loading. Please try again.';
}

/** Why an action didn't go through; "already resolved" means someone else got there first. */
export function actionError( error: unknown ): string {
    if ( error instanceof NetworkError ) {
        return OFFLINE;
    }
    if ( error instanceof ApiError && ( error.status === 404 || error.status === 409 ) ) {
        return `${error.message.replace( /\.$/, '' )}. Reload to see the latest.`;
    }

    return 'Something went wrong, so nothing changed. Please try again.';
}
