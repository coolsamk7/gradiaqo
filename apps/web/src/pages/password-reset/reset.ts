/** The points on the brand panel of the password pages. */
export const HIGHLIGHTS = [ 'Codes expire after 15 minutes', 'We never share your email', 'Your progress stays as it is' ];

export const MIN_PASSWORD = 8;

/** Enough to catch typos; the API checks properly. */
export function isEmail( value: string ): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( value.trim() );
}

export interface ResetErrors {
    email?: string;
    code?: string;
    password?: string;
}

export function validateReset( email: string, code: string, password: string ): ResetErrors {
    return {
        ...( isEmail( email ) ? {} : { email: 'Enter the email you signed up with.' } ),
        ...( /^\d{6}$/.test( code ) ? {} : { code: 'Enter the 6-digit code from the email.' } ),
        ...( password.length >= MIN_PASSWORD ? {} : { password: `Use at least ${MIN_PASSWORD} characters.` } ),
    };
}

/** The id of the first field with an error, to move focus to. */
export function firstInvalid( errors: ResetErrors ): string | undefined {
    if ( errors.email ) {
        return 'email';
    }
    if ( errors.code ) {
        return 'code';
    }

    return errors.password ? 'new-password' : undefined;
}
