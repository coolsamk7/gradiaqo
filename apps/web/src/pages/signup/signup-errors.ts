import type { SignupRequest } from '@studylog/schemas';

import type { FieldErrors, FormErrors } from '../../forms/form-errors.ts';
import { describeApiError, emailError } from '../../forms/form-errors.ts';

export type Field = keyof SignupRequest;

/** Form order, for focusing the first problem. */
export const FIELDS: readonly Field[] = [ 'firstName', 'lastName', 'email', 'password' ];

const LABELS: Record<Field, string> = { firstName: 'First name', lastName: 'Last name', email: 'Email', password: 'Password' };

// Same limits as SignupRequest in @studylog/schemas, so most mistakes are caught without a round trip.
export const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const NAME_MAX = 100;
const EMAIL_MAX = 255;

export const EMAIL_TAKEN = 'An account with this email already exists.';

/** Problems visible without asking the API. */
export function validate( details: SignupRequest ): FieldErrors<Field> {
    const errors: FieldErrors<Field> = {};

    for ( const field of [ 'firstName', 'lastName' ] as const ) {
        const name = details[field].trim();

        if ( !name ) {
            errors[field] = `Enter your ${LABELS[field].toLowerCase()}.`;
        } else if ( name.length > NAME_MAX ) {
            errors[field] = `${LABELS[field]} must be ${NAME_MAX} characters or fewer.`;
        }
    }

    const emailProblem = emailError( details.email );

    if ( emailProblem ) {
        errors.email = emailProblem;
    } else if ( details.email.trim().length > EMAIL_MAX ) {
        errors.email = `Email must be ${EMAIL_MAX} characters or fewer.`;
    }

    if ( !details.password ) {
        errors.password = 'Create a password.';
    } else if ( details.password.length < PASSWORD_MIN ) {
        errors.password = `Use at least ${PASSWORD_MIN} characters.`;
    } else if ( details.password.length > PASSWORD_MAX ) {
        errors.password = `Use ${PASSWORD_MAX} characters or fewer.`;
    }

    return errors;
}

/** What to tell the user when signing up fails. */
export function describeSignupError( error: unknown ): FormErrors<Field> {
    return describeApiError( error, LABELS, {
        409: { field: 'email', message: EMAIL_TAKEN },
    } );
}
