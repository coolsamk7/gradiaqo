import type { PublishedPathJson, PublishedPathSummaryJson } from '@studylog/schemas';
import { PathVisibility } from '@studylog/schemas/enums';

import { ApiError, NetworkError } from '../../api/client.ts';
import { DIFFICULTY_LABELS, TYPE_LABELS } from '../path/item-details.ts';

type PathItem = PublishedPathJson['modules'][number]['topics'][number]['items'][number];

/** What an item is, at a glance: "Article · 30 min", "Book · Ch. 1-3 · Optional", "Problem · Easy". */
export function itemLine( item: PathItem ): string {
    const chapters = typeof item.details.chapters === 'string' && item.details.chapters ? item.details.chapters : undefined;

    return [
        TYPE_LABELS[item.type],
        item.difficulty && DIFFICULTY_LABELS[item.difficulty],
        item.estimatedMinutes ? `${item.estimatedMinutes} min` : undefined,
        chapters,
        item.isOptional ? 'Optional' : undefined,
    ].filter( Boolean ).join( ' · ' );
}

/** Where the path lives, for the About card. */
export function sourceName( path: PublishedPathJson, userId: string ): string {
    const { organization, createdBy } = path;

    if ( !organization ) {
        return 'Official catalog';
    }
    if ( !organization.isPersonal ) {
        return organization.name;
    }

    return createdBy?.id === userId ? 'Your workspace' : 'Community';
}

/** Why enrolling failed. */
export function enrollError( error: unknown ): string {
    if ( error instanceof NetworkError ) {
        return 'Can\'t reach Gradiaqo right now. Check your connection and try again.';
    }
    if ( error instanceof ApiError && error.status === 409 ) {
        return 'You already follow this path. Reload the page to continue it.';
    }

    return error instanceof ApiError && error.status === 404
        ? 'This path isn\'t available any more.'
        : 'Something went wrong, so you weren\'t enrolled. Please try again.';
}

/**
 * Whether the user can report the path: only a public path from another user's workspace (a "community" path).
 * Official paths and organizations' paths aren't reported.
 */
export function isReportable( path: PublishedPathSummaryJson, userId: string ): boolean {
    return path.visibility === PathVisibility.Public
        && path.organization?.isPersonal === true
        && path.createdBy?.id !== userId;
}

/** Why the report wasn't sent; the API explains refusals like "You can't report your own path". */
export function reportError( error: unknown ): string {
    if ( error instanceof NetworkError ) {
        return 'Can\'t reach Gradiaqo right now. Check your connection and try again.';
    }
    if ( error instanceof ApiError && error.status === 429 ) {
        return 'You\'ve sent a lot of reports. Wait a while before sending more.';
    }
    if (
        error instanceof ApiError
        && ( error.status === 400 || error.status === 404 )
        && Object.keys( error.fieldErrors ).length === 0
    ) {
        return `${error.message.replace( /\.$/, '' )}.`;
    }

    return 'Something went wrong, so the report wasn\'t sent. Please try again.';
}
