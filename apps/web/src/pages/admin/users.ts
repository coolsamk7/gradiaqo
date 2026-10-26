import type { AdminUserJson } from '@studylog/schemas';
import { PlatformRole } from '@studylog/schemas/enums';

import { ApiError, NetworkError } from '../../api/client.ts';
import type { MenuAction } from '../../components/Menu.tsx';
import { relativeDay } from '../../format/format.ts';

/* Filters, row actions and messages for Admin › Users. */

/** Users per page. */
export const PAGE_SIZE = 50;

export interface UserFilters {
    search: string;
    role: PlatformRole | '';
    verified: 'yes' | 'no' | '';
    offset: number;
}

/** The API query for the filters: "/admin/users?search=sam&role=superadmin&offset=50". */
export function usersUrl( { search, role, verified, offset }: UserFilters ): string {
    const query = new URLSearchParams( {
        ...( search ? { search } : {} ),
        ...( role ? { role } : {} ),
        ...( verified ? { verified: String( verified === 'yes' ) } : {} ),
        limit: String( PAGE_SIZE ),
        ...( offset ? { offset: String( offset ) } : {} ),
    } );

    return `/admin/users?${query.toString()}`;
}

/** "Today", "Yesterday", "Wed, Oct 21", or "Never" for someone who hasn't logged in since it was tracked. */
export function lastActive( user: AdminUserJson, now: Date ): string {
    return user.lastActiveAt ? relativeDay( new Date( user.lastActiveAt ), now ) : 'Never';
}

/** "51–100 of 120". */
export function pageLabel( offset: number, shown: number, total: number ): string {
    return `${offset + 1}–${offset + shown} of ${total}`;
}

/**
 * Promote or demote, and remove. Never for yourself (the API refuses too), and a superadmin is demoted before
 * they can be removed.
 */
export function userActions(
    user: AdminUserJson,
    myId: string,
    setRole: ( role: PlatformRole ) => void,
    remove: () => void,
): MenuAction[] {
    const isSuperadmin = user.platformRole === PlatformRole.Superadmin;
    const isMe = user.id === myId;

    return [
        { label: 'Make superadmin', hidden: isMe || isSuperadmin, onSelect: () => setRole( PlatformRole.Superadmin ) },
        { label: 'Make normal user', hidden: isMe || !isSuperadmin, onSelect: () => setRole( PlatformRole.ApplicationUser ) },
        { label: 'Remove account', hidden: isMe || isSuperadmin, danger: true, onSelect: remove },
    ];
}

const OFFLINE = 'Can\'t reach StudyLog right now. Check your connection and try again.';

/** Why a change wasn't made; the API explains refusals such as removing the only owner of an organization. */
export function actionError( error: unknown ): string {
    if ( error instanceof NetworkError ) {
        return OFFLINE;
    }
    if ( error instanceof ApiError && [ 400, 404, 409 ].includes( error.status ) ) {
        return `${error.message.replace( /\.$/, '' )}.`;
    }

    return 'Something went wrong, so nothing changed. Please try again.';
}
