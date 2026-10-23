import type { SignupRequest, UserJson } from '@studylog/schemas';
import { createContext, useContext } from 'react';

import type { AuthedRequest } from './authed-request.ts';

export interface Session {
    /** Short-lived (15 minutes); kept in memory only, never in storage. */
    accessToken: string;
    user: UserJson;
}

export type AuthState =
    /** Checking for an existing session at startup. */
    | { status: 'loading' }
    /**
     * `expired`: was logged in, but the session could not be renewed (e.g. logged out on another device).
     * `deleted`: the user just deleted their account.
     */
    | { status: 'anonymous'; expired?: boolean; deleted?: boolean }
    | { status: 'authenticated'; session: Session };

export interface AuthContextValue {
    state: AuthState;
    /** Rejects with ApiError / NetworkError, like the API call. */
    logIn: ( email: string, password: string ) => Promise<void>;
    /** Creates the account and logs in. Rejects with ApiError / NetworkError, like the API call. */
    signUp: ( details: SignupRequest ) => Promise<void>;
    /** Always ends up logged out locally, even if the API can't be reached. */
    logOut: () => Promise<void>;
    /** Shows changes to the logged-in user, e.g. a new name, everywhere at once. */
    updateUser: ( user: UserJson ) => void;
    /** Forgets the session after the account was deleted (the API already ended it); pages go to the homepage. */
    accountDeleted: () => void;
    /**
     * Calls the API as the logged-in user. Renews the access token when it has expired and retries once; if the
     * session is over, logs out (pages behind <RequireAuth> then go to the login page) and rejects with the 401.
     */
    request: AuthedRequest;
}

export const AuthContext = createContext<AuthContextValue | null>( null );

export function useAuth(): AuthContextValue {
    const value = useContext( AuthContext );

    if ( !value ) {
        throw new Error( 'useAuth() must be used inside <AuthProvider>' );
    }

    return value;
}
