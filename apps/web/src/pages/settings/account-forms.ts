import { ApiError, NetworkError } from '../../api/client.ts';

/*
 * Checks and error messages for the account forms on Settings. The API checks again; these catch the obvious
 * mistakes before sending.
 */

export interface ProfileErrors {
    firstName?: string;
    lastName?: string;
}

export function validateProfile( firstName: string, lastName: string ): ProfileErrors {
    return {
        ...( firstName.trim() ? {} : { firstName: 'Enter your first name.' } ),
        ...( lastName.trim() ? {} : { lastName: 'Enter your last name.' } ),
    };
}

export interface PasswordErrors {
    currentPassword?: string;
    newPassword?: string;
}

export const MIN_PASSWORD = 8;

export function validatePassword( currentPassword: string, newPassword: string ): PasswordErrors {
    const errors: PasswordErrors = {};

    if ( !currentPassword ) {
        errors.currentPassword = 'Enter your current password.';
    }
    if ( newPassword.length < MIN_PASSWORD ) {
        errors.newPassword = `Use at least ${MIN_PASSWORD} characters.`;
    } else if ( newPassword === currentPassword ) {
        errors.newPassword = 'Choose a password that\'s different from your current one.';
    }

    return errors;
}

/** Why saving failed, for the form as a whole (field errors are shown on their fields). */
export function saveError( error: unknown ): string {
    return error instanceof NetworkError
        ? 'Can\'t reach Gradiaqo right now. Check your connection and try again.'
        : 'Something went wrong, so nothing was saved. Please try again.';
}

/** A 401 from a form that asks for the password: the password was wrong (not an expired session). */
export function isWrongPassword( error: unknown ): boolean {
    return error instanceof ApiError && error.status === 401 && !error.invalidToken;
}
