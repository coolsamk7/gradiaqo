import { CatalogStatus } from '@studylog/schemas/enums';

import { ApiError, NetworkError } from '../../api/client.ts';
import type { MenuAction } from '../../components/Menu.tsx';

/* Dates, status changes and messages for the global catalog editor. */

const dayMonth = new Intl.DateTimeFormat( 'en-US', { month: 'short', day: 'numeric' } );

/** "Today", or "Sep 25" (Figma: Admin · Catalog › Updated). */
export function formatUpdated( iso: string, now: Date ): string {
    const date = new Date( iso );

    return date.toDateString() === now.toDateString() ? 'Today' : dayMonth.format( date );
}

/**
 * The status changes offered for a path or item: publish it, take it back to draft, or archive it. Deleting is only
 * for drafts (published content may be followed or linked by learners).
 */
export function statusActions(
    status: CatalogStatus,
    change: ( to: CatalogStatus ) => void,
    remove: () => void,
): MenuAction[] {
    return [
        { label: 'Publish', hidden: status === CatalogStatus.Published, onSelect: () => change( CatalogStatus.Published ) },
        { label: 'Move to draft', hidden: status === CatalogStatus.Draft, onSelect: () => change( CatalogStatus.Draft ) },
        { label: 'Archive', hidden: status === CatalogStatus.Archived, onSelect: () => change( CatalogStatus.Archived ) },
        { label: 'Delete', hidden: status !== CatalogStatus.Draft, danger: true, onSelect: remove },
    ];
}

const OFFLINE = 'Can\'t reach Gradiaqo right now. Check your connection and try again.';

export function loadError( error: unknown ): string {
    return error instanceof NetworkError ? OFFLINE : 'Something went wrong while loading. Please try again.';
}

/** Why a change wasn't made; the API explains refusals such as a taken title or deleting published content. */
export function changeError( error: unknown ): string {
    if ( error instanceof NetworkError ) {
        return OFFLINE;
    }
    if ( error instanceof ApiError && [ 404, 409 ].includes( error.status ) ) {
        return `${error.message.replace( /\.$/, '' )}.`;
    }

    return 'Something went wrong, so nothing changed. Please try again.';
}
