import type { ReactNode } from 'react';

import styles from './form.module.css';

interface FormFieldProps {
    /** The input's id and name. */
    field: string;
    label: string;
    /** Always-visible help, e.g. password rules. */
    hint?: string;
    /** Can hold a link, e.g. "Log in instead". */
    error?: ReactNode;
    /** The input; give it `fieldProps()`. */
    children: ReactNode;
}

/** A label, its input, and optional help and error text below it. */
export function FormField( { field, label, hint, error, children }: FormFieldProps ) {
    return (
        <div className={styles.field}>
            <label htmlFor={field} className={styles.label}>{label}</label>
            {children}
            {hint && <p id={`${field}-hint`} className={styles.hint}>{hint}</p>}
            {error && <p id={`${field}-error`} className={styles.fieldError}>{error}</p>}
        </div>
    );
}
