import type { PublishedPathJson } from '@studylog/schemas';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, NetworkError } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';

export type PreviewState =
    | { status: 'loading' }
    /** `notFound`: the path isn't published, or the user can't see it (a wrong or old link). */
    | { status: 'error'; message: string; notFound: boolean }
    | { status: 'ready'; path: PublishedPathJson };

/** A published path with everything in it, before enrolling. `reload()` tries again after an error. */
export function usePathPreview( pathId: string ) {
    const { request } = useAuth();
    const [ state, setState ] = useState<PreviewState>( { status: 'loading' } );
    const [ attempt, setAttempt ] = useState( 0 );

    useEffect( () => {
        request<PublishedPathJson>( `/catalog/paths/${encodeURIComponent( pathId )}` ).then(
            ( path ) => setState( { status: 'ready', path } ),
            ( error: unknown ) => setState( describeError( error ) ),
        );
    }, [ request, pathId, attempt ] );

    const reload = useCallback( () => {
        setState( { status: 'loading' } );
        setAttempt( ( n ) => n + 1 );
    }, [] );

    return { state, reload };
}

function describeError( error: unknown ): PreviewState {
    if ( error instanceof ApiError && ( error.status === 404 || error.status === 400 ) ) {
        return { status: 'error', message: 'This path isn\'t available. It may have been unpublished, or the link is wrong.', notFound: true };
    }

    return {
        status: 'error',
        message: error instanceof NetworkError
            ? 'Can\'t reach Gradiaqo right now. Check your connection and try again.'
            : 'Something went wrong while loading this path. Please try again.',
        notFound: false,
    };
}
