import { ApiError, NetworkError } from '../api/client.ts';

/*
 * Messages for the pages that send or check emailed codes. The API's own messages for codes are written for
 * people ("That code is wrong or has expired…", "Wait a minute…"), so they're shown as they are.
 */

const OFFLINE = 'Can\'t reach StudyLog right now. Check your connection and try again.';

/** Why checking a code, or sending one, failed. */
export function describeCodeError( error: unknown ): string {
    if ( error instanceof NetworkError ) {
        return OFFLINE;
    }
    if ( error instanceof ApiError && error.fieldErrors.code ) {
        return 'Enter the 6-digit code from the email.';
    }
    if ( error instanceof ApiError && [ 400, 409, 429, 503 ].includes( error.status ) ) {
        return error.message;
    }

    return 'Something went wrong. Please try again.';
}

/** "0:42" for a countdown in seconds. */
export function formatCountdown( seconds: number ): string {
    return `${Math.floor( seconds / 60 )}:${String( seconds % 60 ).padStart( 2, '0' )}`;
}
