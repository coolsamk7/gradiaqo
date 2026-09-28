import type { SignupRequest, UserJson } from '@studylog/schemas';
import { createContext, useContext } from 'react';

export interface Session {
    /** Short-lived (15 minutes); kept in memory only, never in storage. */
    accessToken: string;
    user: UserJson;
}

export type AuthState =
    /** Checking for an existing session at startup. */
    | { status: 'loading' }
    | { status: 'anonymous' }
    | { status: 'authenticated'; session: Session };

export interface AuthContextValue {
    state: AuthState;
    /** Rejects with ApiError / NetworkError, like the API call. */
    logIn: ( email: string, password: string ) => Promise<void>;
    /** Creates the account and logs in. Rejects with ApiError / NetworkError, like the API call. */
    signUp: ( details: SignupRequest ) => Promise<void>;
    /** Always ends up logged out locally, even if the API can't be reached. */
    logOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>( null );

export function useAuth(): AuthContextValue {
    const value = useContext( AuthContext );

    if ( !value ) {
        throw new Error( 'useAuth() must be used inside <AuthProvider>' );
    }

    return value;
}
