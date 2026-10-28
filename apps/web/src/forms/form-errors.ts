import { ApiError, NetworkError } from '../api/client.ts';

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

/** What to tell the user when a form fails: a message for the whole form, and/or per-field messages. */
export interface FormErrors<F extends string> {
    form?: string;
    fields: FieldErrors<F>;
}

/** How to explain an error status a form expects: on the whole form, or on one field. */
export type StatusMessage<F extends string> = { form: string } | { field: F; message: string };

// Deliberately loose: the API does the real check. This only catches obvious typos before a round trip.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An email problem visible without asking the API, if any. */
export function emailError( email: string ): string | undefined {
    if ( !email.trim() ) {
        return 'Enter your email.';
    }
    if ( !EMAIL.test( email.trim() ) ) {
        return 'Enter a valid email, like name@example.com.';
    }

    return undefined;
}

/**
 * Turns a failed API call into messages. Handles what every form can hit (no connection, too many attempts,
 * validation errors, server errors); `statuses` explains the ones specific to this form, e.g. 401 on login.
 * `labels` names the form's fields, so the API's validation messages ("must be a valid email address") read as
 * sentences.
 */
export function describeApiError<F extends string>(
    error: unknown,
    labels: Record<F, string>,
    statuses: Partial<Record<number, StatusMessage<F>>> = {},
): FormErrors<F> {
    if ( error instanceof NetworkError ) {
        return { form: 'Can\'t reach Gradiaqo right now. Check your connection and try again.', fields: {} };
    }
    if ( !( error instanceof ApiError ) ) {
        return { form: 'Something went wrong. Please try again.', fields: {} };
    }

    const known = statuses[error.status];

    if ( known ) {
        return 'form' in known ? { form: known.form, fields: {} } : { fields: { [known.field]: known.message } as FieldErrors<F> };
    }

    switch ( error.status ) {
        case 429:
            return { form: `Too many attempts. ${waitMessage( error.retryAfterSeconds )}`, fields: {} };

        case 400: {
            const fields: FieldErrors<F> = {};

            for ( const field of Object.keys( labels ) as F[] ) {
                const message = error.fieldErrors[field];

                if ( message ) {
                    fields[field] = `${labels[field]} ${message}.`;
                }
            }

            return { form: Object.keys( fields ).length > 0 ? undefined : 'Check your details and try again.', fields };
        }

        default:
            return { form: 'Something went wrong. Please try again.', fields: {} };
    }
}

/** Some limits are per hour, so a wait in seconds can be long: show minutes from one minute up. */
function waitMessage( seconds: number | undefined ): string {
    if ( !seconds ) {
        return 'Wait a minute and try again.';
    }

    return seconds < 60
        ? `Try again in ${count( seconds, 'second' )}.`
        : `Try again in ${count( Math.ceil( seconds / 60 ), 'minute' )}.`;
}

function count( amount: number, unit: string ): string {
    return `${amount} ${unit}${amount === 1 ? '' : 's'}`;
}

/** Moves focus to the first field (in form order) with an error, so keyboard and screen reader users land on it. */
export function focusFirstError<F extends string>( order: readonly F[], errors: FieldErrors<F> ): void {
    const field = order.find( ( name ) => errors[name] );

    if ( field ) {
        document.getElementById( field )?.focus();
    }
}
