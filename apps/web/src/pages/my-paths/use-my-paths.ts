import type { LearningPathJson, MyOrganizationJson } from '@studylog/schemas';
import { OrganizationRole } from '@studylog/schemas/enums';

import { useLoaded } from '../../api/use-loaded.ts';
import { loadErrorMessage } from './problems.ts';

const EDITORS: ReadonlySet<string> = new Set( [ OrganizationRole.Owner, OrganizationRole.Admin ] );

/**
 * Where the user can build paths (their workspace first, then organizations they own or run) and the paths in the
 * chosen one; `chosen` is an organization id, or undefined for the first.
 */
export function useMyPaths( chosen: string | undefined ) {
    const organizations = useLoaded<MyOrganizationJson[]>( '/organizations', loadErrorMessage );
    const editable = organizations.state.status === 'ready'
        ? organizations.state.value
                .filter( ( organization ) => organization.role !== null && EDITORS.has( organization.role ) )
                .sort( ( a, b ) => Number( b.isPersonal ) - Number( a.isPersonal ) )
        : [];
    const current = editable.find( ( organization ) => organization.id === chosen ) ?? editable.at( 0 );
    const paths = useLoaded<LearningPathJson[]>( current && `/organizations/${current.id}/catalog/paths`, loadErrorMessage );

    return { organizations: organizations.state, reloadOrganizations: organizations.reload, editable, current, paths };
}
