import type { EnrollmentJson, StudySessionPageJson, StudyStats } from '@studylog/schemas';
import { useCallback, useEffect, useState } from 'react';

import { NetworkError } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';

/** How many recent sessions the dashboard lists. */
export const RECENT_SESSIONS = 3;

export interface DashboardData {
    stats: StudyStats;
    enrollments: EnrollmentJson[];
    sessions: StudySessionPageJson;
}

export type DashboardState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; data: DashboardData };

/** Loads everything the dashboard shows, in parallel. `reload()` tries again after an error. */
export function useDashboard(): { state: DashboardState; reload: () => void } {
    const { request } = useAuth();
    const [ state, setState ] = useState<DashboardState>( { status: 'loading' } );
    const [ attempt, setAttempt ] = useState( 0 );

    useEffect( () => {
        // Days in the stats (today, streaks, the chart) follow the user's own calendar.
        const timeZone = encodeURIComponent( Intl.DateTimeFormat().resolvedOptions().timeZone );

        // No need to ignore late answers: "Try again" is only offered once a load has finished.
        Promise.all( [
            request<StudyStats>( `/me/stats?timeZone=${timeZone}` ),
            request<EnrollmentJson[]>( '/me/enrollments' ),
            request<StudySessionPageJson>( `/me/study-sessions?limit=${RECENT_SESSIONS}` ),
        ] ).then(
            ( [ stats, enrollments, sessions ] ) => setState( { status: 'ready', data: { stats, enrollments, sessions } } ),
            ( error: unknown ) => setState( { status: 'error', message: describeError( error ) } ),
        );
    }, [ request, attempt ] );

    const reload = useCallback( () => {
        setState( { status: 'loading' } );
        setAttempt( ( n ) => n + 1 );
    }, [] );

    return { state, reload };
}

function describeError( error: unknown ): string {
    return error instanceof NetworkError
        ? 'Can\'t reach StudyLog right now. Check your connection and try again.'
        : 'Something went wrong while loading your dashboard. Please try again.';
}
