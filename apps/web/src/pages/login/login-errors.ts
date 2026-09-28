import type { FieldErrors, FormErrors } from '../../forms/form-errors.ts';
import { describeApiError, emailError } from '../../forms/form-errors.ts';

export type Field = 'email' | 'password';

/** Form order, for focusing the first problem. */
export const FIELDS: readonly Field[] = [ 'email', 'password' ];

const LABELS: Record<Field, string> = { email: 'Email', password: 'Password' };

/** Problems visible without asking the API. */
export function validate( email: string, password: string ): FieldErrors<Field> {
    const errors: FieldErrors<Field> = {};
    const emailProblem = emailError( email );

    if ( emailProblem ) {
        errors.email = emailProblem;
    }
    if ( !password ) {
        errors.password = 'Enter your password.';
    }

    return errors;
}

/** What to tell the user when logging in fails. */
export function describeLoginError( error: unknown ): FormErrors<Field> {
    return describeApiError( error, LABELS, {
        401: { form: 'That email and password don\'t match. Check them and try again.' },
    } );
}
