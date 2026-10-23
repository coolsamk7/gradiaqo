import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../auth/auth-context.ts';

export type Loaded<T> =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; value: T };

/**
 * What GET `path` returns (nothing is requested while it's undefined), loaded again by `reload()` (after an error, or
 * after a change); `describe` turns a failure into a message. Each answer is kept with the request it belongs to, so
 * switching to another path shows "loading" right away and stale answers are ignored. A reload after a change keeps
 * showing what was there until the new answer arrives, so the page doesn't flash back to loading.
 */
export function useLoaded<T>( path: string | undefined, describe: ( error: unknown ) => string ) {
    const { request } = useAuth();
    const [ attempt, setAttempt ] = useState( 0 );
    const key = `${path}#${attempt}`;
    const [ answer, setAnswer ] = useState<{ path: string; key: string; state: Loaded<T> }>();
    const [ describeError ] = useState( () => describe );

    useEffect( () => {
        if ( path === undefined ) {
            return undefined;
        }

        let current = true;

        request<T>( path ).then(
            ( value ) => current && setAnswer( { path, key, state: { status: 'ready', value } } ),
            ( error: unknown ) => current
                && setAnswer( { path, key, state: { status: 'error', message: describeError( error ) } } ),
        );

        return () => {
            current = false;
        };
    }, [ request, path, key, describeError ] );

    const reload = useCallback( () => setAttempt( ( n ) => n + 1 ), [] );
    const usable = answer && ( answer.key === key || ( answer.path === path && answer.state.status === 'ready' ) );
    const state: Loaded<T> = usable ? answer.state : { status: 'loading' };

    return { state, reload };
}
