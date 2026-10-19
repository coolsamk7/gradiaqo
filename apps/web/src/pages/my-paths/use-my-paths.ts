import type { LearningPathJson, MyOrganizationJson } from '@studylog/schemas';
import { OrganizationRole } from '@studylog/schemas/enums';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../../auth/auth-context.ts';
import { loadErrorMessage } from './problems.ts';

type Loaded<T> =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; value: T };

const EDITORS: ReadonlySet<string> = new Set( [ OrganizationRole.Owner, OrganizationRole.Admin ] );

/**
 * What GET `path` returns, loaded again by `reload()` (after an error, or after a change). Each answer is kept with
 * the request it belongs to, so switching to another path shows "loading" right away and stale answers are ignored.
 */
function useLoaded<T>( path: string | undefined ) {
    const { request } = useAuth();
    const [ attempt, setAttempt ] = useState( 0 );
    const key = `${path}#${attempt}`;
    const [ answer, setAnswer ] = useState<{ key: string; state: Loaded<T> }>();

    useEffect( () => {
        if ( path === undefined ) {
            return undefined;
        }

        let current = true;

        request<T>( path ).then(
            ( value ) => current && setAnswer( { key, state: { status: 'ready', value } } ),
            ( error: unknown ) => current && setAnswer( { key, state: { status: 'error', message: loadErrorMessage( error ) } } ),
        );

        return () => {
            current = false;
        };
    }, [ request, path, key ] );

    const reload = useCallback( () => setAttempt( ( n ) => n + 1 ), [] );
    const state: Loaded<T> = answer?.key === key ? answer.state : { status: 'loading' };

    return { state, reload };
}

/**
 * Where the user can build paths (their workspace first, then organizations they own or run) and the paths in the
 * chosen one; `chosen` is an organization id, or undefined for the first.
 */
export function useMyPaths( chosen: string | undefined ) {
    const organizations = useLoaded<MyOrganizationJson[]>( '/organizations' );
    const editable = organizations.state.status === 'ready'
        ? organizations.state.value
                .filter( ( organization ) => organization.role !== null && EDITORS.has( organization.role ) )
                .sort( ( a, b ) => Number( b.isPersonal ) - Number( a.isPersonal ) )
        : [];
    const current = editable.find( ( organization ) => organization.id === chosen ) ?? editable.at( 0 );
    const paths = useLoaded<LearningPathJson[]>( current && `/organizations/${current.id}/catalog/paths` );

    return { organizations: organizations.state, reloadOrganizations: organizations.reload, editable, current, paths };
}
