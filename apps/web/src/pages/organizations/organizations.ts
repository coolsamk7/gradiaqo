import { OrganizationRole } from '@studylog/schemas/enums';

import { ApiError, NetworkError } from '../../api/client.ts';
import app from '../../styles/app.module.css';

/*
 * Labels, dates and messages for the Organizations pages. Who may do what is decided by the API; these only choose
 * which buttons to show.
 */

export const ROLE_LABELS: Record<OrganizationRole, string> = {
    [OrganizationRole.Owner]: 'Owner',
    [OrganizationRole.Admin]: 'Admin',
    [OrganizationRole.Member]: 'Member',
};

/** Figma's role badges: Owner inverse, Admin accent, Member neutral. */
export const ROLE_BADGES: Record<OrganizationRole, string> = {
    [OrganizationRole.Owner]: `${app.badge} ${app.badgeInverse}`,
    [OrganizationRole.Admin]: `${app.badge} ${app.badgeAccent}`,
    [OrganizationRole.Member]: app.badge,
};

/** "a Member", "an Admin", "an Owner". */
export const withArticle = ( role: OrganizationRole ): string =>
    `${role === OrganizationRole.Member ? 'a' : 'an'} ${ROLE_LABELS[role]}`;

/** Owners and admins manage members and invitations, and rename the organization. */
export const canManage = ( role: OrganizationRole | null ): boolean =>
    role === OrganizationRole.Owner || role === OrganizationRole.Admin;

export const initials = ( firstName: string, lastName: string ): string =>
    `${firstName.charAt( 0 )}${lastName.charAt( 0 )}`.toUpperCase();

export const count = ( amount: number, word: string ): string => `${amount} ${word}${amount === 1 ? '' : 's'}`;

const DAY = 24 * 60 * 60 * 1000;

/** "expires in 12 days", "expires tomorrow" or "expires today". */
export function expiresIn( expiresAt: string, now: Date ): string {
    const days = Math.ceil( ( new Date( expiresAt ).getTime() - now.getTime() ) / DAY );

    if ( days <= 0 ) {
        return 'expires today';
    }

    return days === 1 ? 'expires tomorrow' : `expires in ${days} days`;
}

/** "sent today", "sent yesterday" or "sent 3 days ago". */
export function sentAgo( createdAt: string, now: Date ): string {
    const days = Math.floor( ( now.getTime() - new Date( createdAt ).getTime() ) / DAY );

    if ( days <= 0 ) {
        return 'sent today';
    }

    return days === 1 ? 'sent yesterday' : `sent ${days} days ago`;
}

const OFFLINE = 'Can\'t reach Gradiaqo right now. Check your connection and try again.';

/** Why an organization (or its lists) couldn't be loaded. */
export function loadError( error: unknown ): string {
    if ( error instanceof NetworkError ) {
        return OFFLINE;
    }

    return error instanceof ApiError && ( error.status === 403 || error.status === 404 )
        ? 'This organization isn\'t here, or you\'re not a member.'
        : 'Something went wrong while loading. Please try again.';
}

/**
 * Why a change wasn't made. The API explains refusals in words people can act on ("This person is already a member",
 * "make someone else owner first"), so those are shown as they are.
 */
export function saveError( error: unknown ): string {
    if ( error instanceof NetworkError ) {
        return OFFLINE;
    }
    if ( error instanceof ApiError && error.status === 403 ) {
        return 'Only the organization\'s owners and admins can do that.';
    }
    if (
        error instanceof ApiError
        && [ 400, 404, 409 ].includes( error.status )
        && Object.keys( error.fieldErrors ).length === 0
    ) {
        return `${error.message.replace( /\.$/, '' )}.`;
    }

    return 'Something went wrong, so nothing changed. Please try again.';
}
