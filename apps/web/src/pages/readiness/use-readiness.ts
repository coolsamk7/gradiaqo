import type { EnrollmentJson, ReadinessJson } from '@studylog/schemas';
import { EnrollmentStatus } from '@studylog/schemas/enums';
import { useCallback, useEffect, useState } from 'react';

import { NetworkError } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';

export interface ReadinessData {
    readiness: ReadinessJson;
    /** Paths the user follows (not dropped): to name the goal's paths and to choose them in the goal dialog. */
    paths: EnrollmentJson[];
}

export type ReadinessState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; data: ReadinessData };

/**
 * The interview goal with its readiness, and the paths the user follows, loaded together. `reload()` loads again
 * (after an error, or once the goal or a path changed); data already shown stays until the new answer comes.
 */
export function useReadiness(): { state: ReadinessState; reload: () => void } {
    const { request } = useAuth();
    const [ state, setState ] = useState<ReadinessState>( { status: 'loading' } );
    const [ attempt, setAttempt ] = useState( 0 );

    useEffect( () => {
        // Streaks and "days left" follow the user's own calendar.
        const timeZone = encodeURIComponent( Intl.DateTimeFormat().resolvedOptions().timeZone );

        Promise.all( [
            request<ReadinessJson>( `/me/readiness?timeZone=${timeZone}` ),
            request<EnrollmentJson[]>( '/me/enrollments' ),
        ] ).then(
            ( [ readiness, enrollments ] ) => setState( {
                status: 'ready',
                data: { readiness, paths: enrollments.filter( ( { status } ) => status !== EnrollmentStatus.Dropped ) },
            } ),
            ( error: unknown ) => setState( { status: 'error', message: describeError( error ) } ),
        );
    }, [ request, attempt ] );

    const reload = useCallback( () => {
        setState( ( current ) => current.status === 'error' ? { status: 'loading' } : current );
        setAttempt( ( n ) => n + 1 );
    }, [] );

    return { state, reload };
}

function describeError( error: unknown ): string {
    return error instanceof NetworkError
        ? 'Can\'t reach StudyLog right now. Check your connection and try again.'
        : 'Something went wrong while loading your readiness. Please try again.';
}
