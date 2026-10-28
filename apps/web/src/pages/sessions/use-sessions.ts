import type { StudySessionPageJson } from '@studylog/schemas';
import { useCallback, useEffect, useState } from 'react';

import { NetworkError } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';

/** Sessions per page of history. */
export const PAGE_SIZE = 20;

export type Session = StudySessionPageJson['items'][number];

export type SessionsState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | {
        status: 'ready';
        items: Session[];
        total: number;
        /** Loading the next page; `moreError` says why the last attempt failed. */
        loadingMore: boolean;
        moreError?: string;
    };

/** The user's study sessions, newest first, a page at a time. `reload()` starts over from the first page. */
export function useSessions() {
    const { request } = useAuth();
    const [ state, setState ] = useState<SessionsState>( { status: 'loading' } );
    const [ attempt, setAttempt ] = useState( 0 );

    const fetchPage = useCallback(
        ( offset: number ) => request<StudySessionPageJson>( `/me/study-sessions?limit=${PAGE_SIZE}&offset=${offset}` ),
        [ request ],
    );

    useEffect( () => {
        fetchPage( 0 ).then(
            ( { items, total } ) => setState( { status: 'ready', items, total, loadingMore: false } ),
            ( error: unknown ) => setState( { status: 'error', message: describeLoadError( error ) } ),
        );
    }, [ fetchPage, attempt ] );

    /** Starts over: after a change, or to retry after an error. Keeps showing the current list meanwhile. */
    const reload = useCallback( () => {
        setState( ( current ) => ( current.status === 'ready' ? current : { status: 'loading' } ) );
        setAttempt( ( n ) => n + 1 );
    }, [] );

    /** Appends the next page. Only offered once the list is ready. */
    const loadMore = useCallback( () => {
        const ready = state as Extract<SessionsState, { status: 'ready' }>;
        const { items } = ready;

        setState( { ...ready, loadingMore: true, moreError: undefined } );
        fetchPage( items.length ).then(
            ( page ) => setState( { status: 'ready', items: [ ...items, ...page.items ], total: page.total, loadingMore: false } ),
            ( error: unknown ) => setState( { ...ready, loadingMore: false, moreError: describeLoadError( error ) } ),
        );
    }, [ state, fetchPage ] );

    return { state, reload, loadMore };
}

function describeLoadError( error: unknown ): string {
    return error instanceof NetworkError
        ? 'Can\'t reach Gradiaqo right now. Check your connection and try again.'
        : 'Something went wrong while loading your sessions. Please try again.';
}
