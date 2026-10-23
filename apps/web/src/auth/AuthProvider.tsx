import type { SignupRequest, UserJson } from '@studylog/schemas';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getCurrentUser, login, logout, refreshSession, signup } from '../api/auth.ts';
import type { AuthState, Session } from './auth-context.ts';
import { AuthContext } from './auth-context.ts';
import { createAuthedRequests } from './authed-request.ts';

/**
 * Holds the logged-in session. At startup it tries to restore one from the refresh cookie, so reloading the page
 * doesn't log the user out.
 */
export function AuthProvider( { children }: { children: ReactNode } ) {
    const [ state, setState ] = useState<AuthState>( { status: 'loading' } );
    // StrictMode runs effects twice in development; two refreshes with the same cookie would race.
    const restoring = useRef( false );
    // Keeps the token request() sends, and renews it. Created once: it must outlive re-renders.
    const [ requests ] = useState( () => createAuthedRequests( {
        renewed: ( accessToken ) => {
            setState( ( current ) => ( current.status === 'authenticated'
                ? { status: 'authenticated', session: { ...current.session, accessToken } }
                : current ) );
        },
        // Only if still logged in: a renewal that fails after logging out changes nothing.
        ended: () => {
            setState( ( current ) => ( current.status === 'authenticated' ? { status: 'anonymous', expired: true } : current ) );
        },
    } ) );

    const authenticate = useCallback( ( session: Session ) => {
        requests.setToken( session.accessToken );
        setState( { status: 'authenticated', session } );
    }, [ requests ] );

    useEffect( () => {
        if ( restoring.current ) {
            return;
        }
        restoring.current = true;
        void restoreSession().then( ( session ) => {
            if ( session ) {
                authenticate( session );
            } else {
                setState( { status: 'anonymous' } );
            }
        } );
    }, [ authenticate ] );

    const logIn = useCallback( async ( email: string, password: string ) => {
        authenticate( await login( { email, password } ) );
    }, [ authenticate ] );

    const signUp = useCallback( async ( details: SignupRequest ) => {
        authenticate( await signup( details ) );
    }, [ authenticate ] );

    const logOut = useCallback( async () => {
        try {
            await logout();
        } catch {
            // Logged out locally regardless; the server session expires on its own.
        } finally {
            requests.setToken( '' );
            setState( { status: 'anonymous' } );
        }
    }, [ requests ] );

    const updateUser = useCallback( ( user: UserJson ) => {
        setState( ( current ) => ( current.status === 'authenticated'
            ? { status: 'authenticated', session: { ...current.session, user } }
            : current ) );
    }, [] );

    const accountDeleted = useCallback( () => {
        requests.setToken( '' );
        setState( { status: 'anonymous', deleted: true } );
    }, [ requests ] );

    const { request } = requests;

    const value = useMemo(
        () => ( { state, logIn, signUp, logOut, updateUser, accountDeleted, request } ),
        [ state, logIn, signUp, logOut, updateUser, accountDeleted, request ],
    );

    return <AuthContext value={value}>{children}</AuthContext>;
}

async function restoreSession(): Promise<Session | null> {
    try {
        const { accessToken } = await refreshSession();

        return { accessToken, user: await getCurrentUser( accessToken ) };
    } catch {
        return null;
    }
}
