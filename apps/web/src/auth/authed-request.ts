import { refreshSession } from '../api/auth.ts';
import type { RequestOptions } from '../api/client.ts';
import { ApiError, apiRequest } from '../api/client.ts';

/** Calls the API as the logged-in user. Same results as apiRequest(). */
export type AuthedRequest = <T>( path: string, options?: Omit<RequestOptions, 'accessToken'> ) => Promise<T>;

export interface SessionEvents {
    /** A new access token was issued. */
    renewed: ( accessToken: string ) => void;
    /** The session can't be renewed (logged out elsewhere, expired, revoked): log out here too. */
    ended: () => void;
}

export interface AuthedRequests {
    request: AuthedRequest;
    /** The token to send from now on: after logging in, or '' after logging out. */
    setToken: ( accessToken: string ) => void;
}

/** How long to wait before retrying a refresh that lost a race with another tab (see renewSession()). */
export const REFRESH_RETRY_DELAY_MS = 500;

/**
 * Makes requests with the access token, and renews it when it expires (15 minutes). On a 401 caused by the token,
 * it gets a new one with the refresh cookie and retries the request once. If the session can't be renewed, it calls
 * `ended()` and rejects with the API's 401.
 */
export function createAuthedRequests( events: SessionEvents ): AuthedRequests {
    let token = '';
    let renewal: Promise<string> | undefined;

    // One renewal at a time for all requests: each refresh rotates the cookie, so two at once would race.
    const renew = (): Promise<string> => {
        renewal ??= renewSession()
            .then( ( accessToken ) => {
                token = accessToken;
                events.renewed( accessToken );

                return accessToken;
            }, ( error: unknown ) => {
                // No connection says nothing about the session: stay logged in.
                if ( error instanceof ApiError ) {
                    token = '';
                    events.ended();
                }
                throw error;
            } )
            .finally( () => {
                renewal = undefined;
            } );

        return renewal;
    };

    const request = async <T>( path: string, options: Omit<RequestOptions, 'accessToken'> = {} ): Promise<T> => {
        const sent = token;

        try {
            return await apiRequest<T>( path, { ...options, accessToken: sent } );
        } catch ( error ) {
            if ( !( error instanceof ApiError && error.invalidToken ) ) {
                throw error;
            }
        }

        // Another request may have renewed the token while this one was out.
        const fresh = token === sent ? await renew() : token;

        return apiRequest<T>( path, { ...options, accessToken: fresh } );
    };

    return {
        request,
        setToken: ( accessToken ) => {
            token = accessToken;
        },
    };
}

/**
 * Swaps the refresh cookie for a new access token. When two tabs refresh at the same moment, the API accepts one and
 * answers the other with a 401 (keeping the session), while the winner's response updates the shared cookie. So a
 * 401 is retried once, a moment later, with whatever cookie the browser has by then.
 */
export async function renewSession(): Promise<string> {
    try {
        return ( await refreshSession() ).accessToken;
    } catch ( error ) {
        if ( !( error instanceof ApiError && error.status === 401 ) ) {
            throw error;
        }
    }
    await new Promise( ( resolve ) => setTimeout( resolve, REFRESH_RETRY_DELAY_MS ) );

    return ( await refreshSession() ).accessToken;
}
