/** The API answered with an error status. */
export class ApiError extends Error {
    readonly status: number;
    /** Validation errors by field, e.g. `{ email: 'must be a valid email address' }`. */
    readonly fieldErrors: Record<string, string>;
    /** From `Retry-After` on 429 (too many requests). */
    readonly retryAfterSeconds: number | undefined;

    constructor(
        status: number,
        message: string,
        fieldErrors: Record<string, string> = {},
        retryAfterSeconds?: number,
    ) {
        super( message );
        this.name = 'ApiError';
        this.status = status;
        this.fieldErrors = fieldErrors;
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

/** The API couldn't be reached at all (offline, server down, blocked by CORS). */
export class NetworkError extends Error {
    constructor() {
        super( 'The StudyLog API could not be reached' );
        this.name = 'NetworkError';
    }
}

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
    accessToken?: string;
}

interface ErrorBody {
    message?: unknown;
    errors?: { path: string; message: string }[];
}

/**
 * Calls the API. Always sends cookies (`credentials: 'include'`), which carry the refresh token to `/auth/*`.
 * Resolves with the parsed JSON body (undefined for 204), or rejects with ApiError / NetworkError.
 */
export async function apiRequest<T>( path: string, { method = 'GET', body, accessToken }: RequestOptions = {} ): Promise<T> {
    let response: Response;

    try {
        response = await fetch( `${__API_URL__}${path}`, {
            method,
            credentials: 'include',
            headers: {
                ...( body !== undefined && { 'Content-Type': 'application/json' } ),
                ...( accessToken && { Authorization: `Bearer ${accessToken}` } ),
            },
            body: body === undefined ? undefined : JSON.stringify( body ),
        } );
    } catch {
        throw new NetworkError();
    }

    if ( response.status === 204 ) {
        return undefined as T;
    }

    // Error pages from a proxy may not be JSON.
    const data: unknown = await response.json().catch( () => undefined );

    if ( !response.ok ) {
        throw toApiError( response, data );
    }

    return data as T;
}

function toApiError( response: Response, body: unknown ): ApiError {
    const { message, errors = [] } = ( body ?? {} ) as ErrorBody;
    // Keep the first message per field: e.g. "/email" → "email".
    const fieldErrors = Object.fromEntries( errors.toReversed().map( ( error ) => [ error.path.replace( /^\//, '' ), error.message ] ) );
    const retryAfter = Number( response.headers.get( 'Retry-After' ) );

    return new ApiError(
        response.status,
        typeof message === 'string' ? message : response.statusText,
        fieldErrors,
        retryAfter > 0 ? retryAfter : undefined,
    );
}
