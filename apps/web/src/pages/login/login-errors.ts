import { ApiError, NetworkError } from '../../api/client.ts';

export type Field = 'email' | 'password';
export type FieldErrors = Partial<Record<Field, string>>;

const LABELS: Record<Field, string> = { email: 'Email', password: 'Password' };

// Deliberately loose: the API does the real check. This only catches obvious typos before a round trip.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Problems visible without asking the API. */
export function validate( email: string, password: string ): FieldErrors {
    const errors: FieldErrors = {};

    if ( !email.trim() ) {
        errors.email = 'Enter your email.';
    } else if ( !EMAIL.test( email.trim() ) ) {
        errors.email = 'Enter a valid email, like name@example.com.';
    }
    if ( !password ) {
        errors.password = 'Enter your password.';
    }

    return errors;
}

/** What to tell the user when logging in fails: a message for the form, and/or per-field messages. */
export function describeLoginError( error: unknown ): { form?: string; fields: FieldErrors } {
    if ( error instanceof NetworkError ) {
        return { form: 'Can\'t reach StudyLog right now. Check your connection and try again.', fields: {} };
    }
    if ( !( error instanceof ApiError ) ) {
        return { form: 'Something went wrong. Please try again.', fields: {} };
    }

    switch ( error.status ) {
        case 401:
            return { form: 'That email and password don\'t match. Check them and try again.', fields: {} };

        case 429:
            return {
                form: error.retryAfterSeconds
                    ? `Too many attempts. Try again in ${error.retryAfterSeconds} seconds.`
                    : 'Too many attempts. Wait a minute and try again.',
                fields: {},
            };

        case 400: {
            // The API's validation messages continue the field name: "must be a valid email address".
            const fields: FieldErrors = {};

            for ( const field of Object.keys( LABELS ) as Field[] ) {
                const message = error.fieldErrors[field];

                if ( message ) {
                    fields[field] = `${LABELS[field]} ${message}.`;
                }
            }

            return { form: Object.keys( fields ).length > 0 ? undefined : 'Check your details and try again.', fields };
        }

        default:
            return { form: 'Something went wrong. Please try again.', fields: {} };
    }
}
