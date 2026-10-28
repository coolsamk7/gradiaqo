import type { AnalyticsJson, AnalyticsPeriod, EnrollmentJson } from '@studylog/schemas';
import { EnrollmentStatus } from '@studylog/schemas/enums';
import { useCallback, useEffect, useState } from 'react';

import { NetworkError } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';

export type AnalyticsState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; data: AnalyticsJson };

/**
 * Analytics for a period, for every path or one (`enrollmentId`). Each answer is kept with the query it belongs to,
 * so a new filter shows "loading" right away and stale answers are ignored.
 */
export function useAnalytics( period: AnalyticsPeriod, enrollmentId: string | undefined ) {
    const { request } = useAuth();
    const [ attempt, setAttempt ] = useState( 0 );
    const query = new URLSearchParams( {
        period,
        ...( enrollmentId ? { enrollmentId } : {} ),
        // Weeks, weekdays and hours follow the user's own calendar.
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    } ).toString();
    const key = `${query}#${attempt}`;
    const [ answer, setAnswer ] = useState<{ key: string; state: AnalyticsState }>();

    useEffect( () => {
        let current = true;

        request<AnalyticsJson>( `/me/analytics?${query}` ).then(
            ( data ) => current && setAnswer( { key, state: { status: 'ready', data } } ),
            ( error: unknown ) => current && setAnswer( { key, state: { status: 'error', message: describeError( error ) } } ),
        );

        return () => {
            current = false;
        };
    }, [ request, query, key ] );

    const reload = useCallback( () => setAttempt( ( n ) => n + 1 ), [] );
    const state: AnalyticsState = answer?.key === key ? answer.state : { status: 'loading' };

    return { state, reload };
}

/** The paths the user follows (not dropped), for the path filter. Empty until loaded or if loading fails. */
export function useFollowedPaths(): EnrollmentJson[] {
    const { request } = useAuth();
    const [ paths, setPaths ] = useState<EnrollmentJson[]>( [] );

    useEffect( () => {
        let current = true;

        // Without the list, the filter only offers "All paths"; the analytics themselves still load.
        request<EnrollmentJson[]>( '/me/enrollments' ).then(
            ( enrollments ) => current && setPaths( enrollments.filter( isFollowed ) ),
            () => undefined,
        );

        return () => {
            current = false;
        };
    }, [ request ] );

    return paths;
}

function isFollowed( enrollment: EnrollmentJson ): boolean {
    return enrollment.status !== EnrollmentStatus.Dropped;
}

function describeError( error: unknown ): string {
    return error instanceof NetworkError
        ? 'Can\'t reach Gradiaqo right now. Check your connection and try again.'
        : 'Something went wrong while loading your analytics. Please try again.';
}
