import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getCurrentUser, login, logout, refreshSession } from '../api/auth.ts';
import type { AuthState, Session } from './auth-context.ts';
import { AuthContext } from './auth-context.ts';

/**
 * Holds the logged-in session. At startup it tries to restore one from the refresh cookie, so reloading the page
 * doesn't log the user out.
 */
export function AuthProvider( { children }: { children: ReactNode } ) {
    const [ state, setState ] = useState<AuthState>( { status: 'loading' } );
    // StrictMode runs effects twice in development; two refreshes with the same cookie would race.
    const restoring = useRef( false );

    useEffect( () => {
        if ( restoring.current ) {
            return;
        }
        restoring.current = true;
        void restoreSession().then( ( session ) => {
            setState( session ? { status: 'authenticated', session } : { status: 'anonymous' } );
        } );
    }, [] );

    const logIn = useCallback( async ( email: string, password: string ) => {
        const { accessToken, user } = await login( { email, password } );

        setState( { status: 'authenticated', session: { accessToken, user } } );
    }, [] );

    const logOut = useCallback( async () => {
        try {
            await logout();
        } catch {
            // Logged out locally regardless; the server session expires on its own.
        } finally {
            setState( { status: 'anonymous' } );
        }
    }, [] );

    const value = useMemo( () => ( { state, logIn, logOut } ), [ state, logIn, logOut ] );

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
