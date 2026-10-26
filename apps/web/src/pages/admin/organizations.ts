import type { AdminOrganizationJson } from '@studylog/schemas';

import { PAGE_SIZE } from './users.ts';

/* Filters and words for Admin › Organizations. */

export interface OrganizationFilters {
    search: string;
    /** Include personal workspaces. */
    personal: boolean;
    offset: number;
}

/** The API query for the filters: "/admin/organizations?search=club&personal=true&limit=50". */
export function organizationsUrl( { search, personal, offset }: OrganizationFilters ): string {
    const query = new URLSearchParams( {
        ...( search ? { search } : {} ),
        ...( personal ? { personal: 'true' } : {} ),
        limit: String( PAGE_SIZE ),
        ...( offset ? { offset: String( offset ) } : {} ),
    } );

    return `/admin/organizations?${query.toString()}`;
}

/** "Alice Walker", "Alice Walker +1", or "No owner" (an owner deleted their account and nobody took over). */
export function ownersLabel( organization: AdminOrganizationJson ): string {
    const [ first, ...others ] = organization.owners;

    if ( !first ) {
        return 'No owner';
    }

    return `${first.firstName} ${first.lastName}${others.length > 0 ? ` +${others.length}` : ''}`;
}
