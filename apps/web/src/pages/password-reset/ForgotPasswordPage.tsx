import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { apiRequest } from '../../api/client.ts';
import { useAuthPageState } from '../../auth/auth-page-state.ts';
import { AuthLayout } from '../../components/AuthLayout.tsx';
import { Icon } from '../../components/Icon.tsx';
import { describeCodeError } from '../../forms/code-errors.ts';
import { fieldProps } from '../../forms/field-props.ts';
import form from '../../forms/form.module.css';
import { FormField } from '../../forms/FormField.tsx';
import shared from '../../styles/shared.module.css';
import styles from './PasswordReset.module.css';
import { HIGHLIGHTS, isEmail } from './reset.ts';

/** Asking for a code to reset a forgotten password (Figma: M3 › Forgot password). Then on to Reset password. */
export function ForgotPasswordPage() {
    const navigate = useNavigate();
    const { email: initial = '' } = useAuthPageState();
    const [ email, setEmail ] = useState( initial );
    const [ error, setError ] = useState<string>();
    const [ formError, setFormError ] = useState<string>();
    const [ sending, setSending ] = useState( false );

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        setFormError( undefined );
        if ( !isEmail( email ) ) {
            setError( 'Enter the email you signed up with.' );
            document.getElementById( 'email' )?.focus();

            return;
        }

        setSending( true );
        setError( undefined );
        try {
            await apiRequest( '/auth/forgot-password', { method: 'POST', body: { email: email.trim() } } );
            void navigate( '/reset-password', { state: { email: email.trim() } } );
        } catch ( failure ) {
            setFormError( describeCodeError( failure ) );
            setSending( false );
        }
    };

    return (
        <AuthLayout
            brandTitle="Locked out? It happens."
            highlights={HIGHLIGHTS}
            before={(
                <Link to="/login" state={{ email }} className={`${shared.button} ${shared.ghost} ${shared.small} ${styles.back}`}>
                    <Icon name="chevron-left" />
                    Back to log in
                </Link>
            )}
            title="Reset your password"
            subtitle="Enter your account's email and we'll send you a code to choose a new password."
            alternative={(
                <>
                    Remembered it?
                    {' '}
                    <Link to="/login" state={{ email }}>Log in</Link>
                </>
            )}
        >
            {formError && <p className={form.formError} role="alert">{formError}</p>}
            <form className={form.form} onSubmit={( event ) => void onSubmit( event )} noValidate>
                <FormField field="email" label="Email" error={error}>
                    <input
                        {...fieldProps( 'email', error )}
                        type="email"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={( event ) => setEmail( event.target.value )}
                    />
                </FormField>
                <button type="submit" className={`${shared.button} ${shared.primary} ${form.submit}`} disabled={sending}>
                    {sending ? 'Sending…' : 'Send reset code'}
                </button>
            </form>
        </AuthLayout>
    );
}
