import type { PublishedPathSummaryJson } from '@studylog/schemas';
import { useCallback, useEffect, useState } from 'react';

import { NetworkError } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';
import type { Source } from './catalog-paths.ts';

export type CatalogState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; paths: PublishedPathSummaryJson[] };

/**
 * The paths the user can see, filtered by where they come from and a title search. Each answer is kept with the
 * query it belongs to, so a new filter shows "loading" right away and stale answers are ignored.
 */
export function useCatalog( source: Source | undefined, search: string ) {
    const { request } = useAuth();
    const [ attempt, setAttempt ] = useState( 0 );
    const query = new URLSearchParams( {
        ...( source ? { source } : {} ),
        ...( search ? { search } : {} ),
    } ).toString();
    const key = `${query}#${attempt}`;
    const [ answer, setAnswer ] = useState<{ key: string; state: CatalogState }>();

    useEffect( () => {
        let current = true;

        request<PublishedPathSummaryJson[]>( `/catalog/paths${query ? `?${query}` : ''}` ).then(
            ( paths ) => current && setAnswer( { key, state: { status: 'ready', paths } } ),
            ( error: unknown ) => current && setAnswer( { key, state: { status: 'error', message: describeLoadError( error ) } } ),
        );

        // A newer query replaced this one: its answer, whenever it comes, is ignored.
        return () => {
            current = false;
        };
    }, [ request, query, key ] );

    const reload = useCallback( () => setAttempt( ( n ) => n + 1 ), [] );
    const state: CatalogState = answer?.key === key ? answer.state : { status: 'loading' };

    return { state, reload };
}

function describeLoadError( error: unknown ): string {
    return error instanceof NetworkError
        ? 'Can\'t reach Gradiaqo right now. Check your connection and try again.'
        : 'Something went wrong while loading the catalog. Please try again.';
}
