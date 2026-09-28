import styles from './form.module.css';

/** Props that tie an input to its label, hint and error, so screen readers announce them. */
export function fieldProps( field: string, error: unknown, hint?: string ) {
    const describedBy = [ hint && `${field}-hint`, error && `${field}-error` ].filter( Boolean ).join( ' ' );

    return {
        id: field,
        name: field,
        className: styles.input,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
    };
}
