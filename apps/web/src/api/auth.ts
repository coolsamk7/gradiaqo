import type { AccessTokenResponse, AuthResponse, LoginRequest, SignupRequest, UserJson } from '@studylog/schemas';

import { apiRequest } from './client.ts';

/** Creates an account and starts a session, like login(). Fails with 409 if the email is already registered. */
export function signup( details: SignupRequest ): Promise<AuthResponse> {
    return apiRequest<AuthResponse>( '/auth/signup', { method: 'POST', body: details } );
}

/** Starts a session: returns an access token and the user, and sets the refresh cookie. */
export function login( credentials: LoginRequest ): Promise<AuthResponse> {
    return apiRequest<AuthResponse>( '/auth/login', { method: 'POST', body: credentials } );
}

/** Swaps the refresh cookie for a new access token (and a new cookie). Fails if there's no valid session. */
export function refreshSession(): Promise<AccessTokenResponse> {
    return apiRequest<AccessTokenResponse>( '/auth/refresh', { method: 'POST' } );
}

export function getCurrentUser( accessToken: string ): Promise<UserJson> {
    return apiRequest<UserJson>( '/auth/me', { accessToken } );
}

/** Ends this device's session and clears the refresh cookie. */
export function logout(): Promise<void> {
    return apiRequest<undefined>( '/auth/logout', { method: 'POST' } );
}
