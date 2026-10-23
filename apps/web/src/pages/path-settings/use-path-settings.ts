import type { EnrollmentDetailJson, PublishedPathJson } from '@studylog/schemas';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, NetworkError } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';

export interface SettingsData {
    enrollment: EnrollmentDetailJson;
    /** The whole published path, to choose parts from; null if it can't be loaded (e.g. it was unpublished). */
    path: PublishedPathJson | null;
}

export type SettingsState =
    | { status: 'loading' }
    /** `notFound`: no such enrollment for this user (a wrong link, or they left the path). */
    | { status: 'error'; message: string; notFound: boolean }
    | { status: 'ready'; data: SettingsData };

/**
 * An enrollment and the published path behind it. `refresh()` loads both again after a change, keeping the page as
 * it is meanwhile; `reload()` starts over after an error.
 */
export function usePathSettings( enrollmentId: string ) {
    const { request } = useAuth();
    const [ state, setState ] = useState<SettingsState>( { status: 'loading' } );
    const [ attempt, setAttempt ] = useState( 0 );

    const fetchData = useCallback( async (): Promise<SettingsData> => {
        const enrollment = await request<EnrollmentDetailJson>( `/me/enrollments/${encodeURIComponent( enrollmentId )}` );
        const path = await request<PublishedPathJson>( `/catalog/paths/${enrollment.learningPath.id}` ).catch( () => null );

        return { enrollment, path };
    }, [ request, enrollmentId ] );

    useEffect( () => {
        fetchData().then(
            ( data ) => setState( { status: 'ready', data } ),
            ( error: unknown ) => setState( describeError( error ) ),
        );
    }, [ fetchData, attempt ] );

    const reload = useCallback( () => {
        setState( { status: 'loading' } );
        setAttempt( ( n ) => n + 1 );
    }, [] );

    /** After a saved change. If loading fails, the page keeps what it showed; the next visit has the change. */
    const refresh = useCallback(
        () => fetchData().then( ( data ) => setState( { status: 'ready', data } ), () => undefined ),
        [ fetchData ],
    );

    return { state, reload, refresh };
}

function describeError( error: unknown ): SettingsState {
    if ( error instanceof ApiError && ( error.status === 404 || error.status === 400 ) ) {
        return { status: 'error', message: 'This learning path isn\'t on your list.', notFound: true };
    }

    return {
        status: 'error',
        message: error instanceof NetworkError
            ? 'Can\'t reach StudyLog right now. Check your connection and try again.'
            : 'Something went wrong while loading the settings. Please try again.',
        notFound: false,
    };
}
