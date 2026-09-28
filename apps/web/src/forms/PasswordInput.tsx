import type { InputHTMLAttributes, Ref } from 'react';
import { useState } from 'react';

import styles from './form.module.css';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { ref?: Ref<HTMLInputElement> };

/** A password field with a Show/Hide button, so people can check what they typed. */
export function PasswordInput( props: PasswordInputProps ) {
    const [ shown, setShown ] = useState( false );

    return (
        <div className={styles.passwordRow}>
            <input {...props} type={shown ? 'text' : 'password'} />
            <button
                type="button"
                className={styles.toggle}
                aria-label={shown ? 'Hide password' : 'Show password'}
                aria-pressed={shown}
                onClick={() => setShown( ( value ) => !value )}
            >
                {shown ? 'Hide' : 'Show'}
            </button>
        </div>
    );
}
