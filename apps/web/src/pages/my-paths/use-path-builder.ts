import type { LearningPathTreeJson, MyOrganizationJson } from '@studylog/schemas';
import { useCallback, useEffect, useState } from 'react';

import type { RequestOptions } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';
import { loadErrorMessage } from './problems.ts';

export type BuilderState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; path: LearningPathTreeJson; organization: MyOrganizationJson };

type Ready = Extract<BuilderState, { status: 'ready' }>;

export type Send = <T = unknown>( path: string, options?: Omit<RequestOptions, 'accessToken'> ) => Promise<T>;

/**
 * A path being built, with everything in it, and the organization it belongs to. `send()` makes a change (paths
 * relative to the organization's catalog, e.g. "/topics/{id}") and then loads the path again, since one change can move things at every level. It rejects
 * when the change wasn't saved, so the form that sent it can say why.
 */
export function usePathBuilder( organizationId: string, pathId: string ) {
    const { request } = useAuth();
    const [ state, setState ] = useState<BuilderState>( { status: 'loading' } );
    const [ attempt, setAttempt ] = useState( 0 );
    const base = `/organizations/${encodeURIComponent( organizationId )}/catalog`;

    const fetchPath = useCallback(
        () => request<LearningPathTreeJson>( `${base}/paths/${encodeURIComponent( pathId )}` ),
        [ request, base, pathId ],
    );

    useEffect( () => {
        Promise.all( [ fetchPath(), request<MyOrganizationJson>( `/organizations/${encodeURIComponent( organizationId )}` ) ] ).then(
            ( [ path, organization ] ) => setState( { status: 'ready', path, organization } ),
            ( error: unknown ) => setState( { status: 'error', message: loadErrorMessage( error ) } ),
        );
    }, [ fetchPath, request, organizationId, attempt ] );

    const reload = useCallback( () => {
        setState( { status: 'loading' } );
        setAttempt( ( n ) => n + 1 );
    }, [] );

    const send: Send = useCallback( async <T>( path: string, options?: Omit<RequestOptions, 'accessToken'> ) => {
        const result = await request<T>( `${base}${path}`, options );

        // Saved. If loading the new tree fails, the page shows the old one until the next change or visit.
        // Changes are only made on a loaded path, so the state is 'ready' here.
        await fetchPath().then(
            ( tree ) => setState( ( current ) => ( { ...current as Ready, path: tree } ) ),
            () => undefined,
        );

        return result;
    }, [ request, base, fetchPath ] );

    return { state, reload, send };
}
