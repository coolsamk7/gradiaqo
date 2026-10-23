import type { EnrollmentDetailJson } from '@studylog/schemas';
import type { ProgressStatus } from '@studylog/schemas/enums';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, NetworkError } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';

export type PathState =
    | { status: 'loading' }
    /** `notFound`: no such enrollment for this user (a wrong link, or they left the path). */
    | { status: 'error'; message: string; notFound: boolean }
    | { status: 'ready'; path: EnrollmentDetailJson };

/**
 * The user's view of a learning path (an enrollment): its modules, topics and items with progress. `setStatus()`
 * saves the status of an item and then loads the path again, since one change moves the counts at every level
 * (and finishing the last required item completes the enrollment).
 */
export function usePath( enrollmentId: string ) {
    const { request } = useAuth();
    const [ state, setState ] = useState<PathState>( { status: 'loading' } );
    const [ attempt, setAttempt ] = useState( 0 );

    const fetchPath = useCallback(
        () => request<EnrollmentDetailJson>( `/me/enrollments/${encodeURIComponent( enrollmentId )}` ),
        [ request, enrollmentId ],
    );

    useEffect( () => {
        fetchPath().then(
            ( path ) => setState( { status: 'ready', path } ),
            ( error: unknown ) => setState( describeLoadError( error ) ),
        );
    }, [ fetchPath, attempt ] );

    const reload = useCallback( () => {
        setState( { status: 'loading' } );
        setAttempt( ( n ) => n + 1 );
    }, [] );

    /** Rejects if the change wasn't saved; the page stays as it was. */
    const setStatus = useCallback( async ( itemId: string, status: ProgressStatus ) => {
        await request( `/me/progress/${itemId}`, { method: 'PUT', body: { status } } );

        // Saved. If loading the new counts fails, the next visit shows them.
        await fetchPath().then( ( path ) => setState( { status: 'ready', path } ), () => undefined );
    }, [ request, fetchPath ] );

    return { state, reload, setStatus };
}

function describeLoadError( error: unknown ): PathState {
    if ( error instanceof ApiError && ( error.status === 404 || error.status === 400 ) ) {
        return { status: 'error', message: 'This learning path isn\'t on your list. The link may be wrong, or you left the path.', notFound: true };
    }

    return {
        status: 'error',
        message: error instanceof NetworkError
            ? 'Can\'t reach StudyLog right now. Check your connection and try again.'
            : 'Something went wrong while loading this path. Please try again.',
        notFound: false,
    };
}
