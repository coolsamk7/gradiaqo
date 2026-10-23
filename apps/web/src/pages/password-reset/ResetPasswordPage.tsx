import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { apiRequest } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';
import { useAuthPageState } from '../../auth/auth-page-state.ts';
import { AuthLayout } from '../../components/AuthLayout.tsx';
import { Icon } from '../../components/Icon.tsx';
import { describeCodeError } from '../../forms/code-errors.ts';
import { fieldProps } from '../../forms/field-props.ts';
import form from '../../forms/form.module.css';
import { FormField } from '../../forms/FormField.tsx';
import { PasswordInput } from '../../forms/PasswordInput.tsx';
import shared from '../../styles/shared.module.css';
import styles from './PasswordReset.module.css';
import type { ResetErrors } from './reset.ts';
import { firstInvalid, HIGHLIGHTS, MIN_PASSWORD, validateReset } from './reset.ts';

/**
 * Choosing a new password with the emailed code (Figma: M3 › Reset password). The email comes from Forgot
 * password; opened directly, the page asks for it too. Afterwards the user logs in with the new password.
 */
export function ResetPasswordPage() {
    const { state, logOut } = useAuth();
    const navigate = useNavigate();
    const { email: knownEmail } = useAuthPageState();
    const [ email, setEmail ] = useState( knownEmail ?? '' );
    const [ code, setCode ] = useState( '' );
    const [ password, setPassword ] = useState( '' );
    const [ errors, setErrors ] = useState<ResetErrors>( {} );
    const [ formError, setFormError ] = useState<string>();
    const [ notice, setNotice ] = useState<string>();
    const [ saving, setSaving ] = useState( false );

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        const found = validateReset( email, code, password );
        const invalid = firstInvalid( found );

        setErrors( found );
        setFormError( undefined );
        setNotice( undefined );
        if ( invalid ) {
            document.getElementById( invalid )?.focus();

            return;
        }

        setSaving( true );
        try {
            await apiRequest( '/auth/reset-password', { method: 'POST', body: { email: email.trim(), code, newPassword: password } } );
            // Every session ended with the reset, this one too.
            if ( state.status === 'authenticated' ) {
                await logOut();
            }
            void navigate( '/login', {
                replace: true,
                state: { email: email.trim(), notice: 'Your password was changed. Log in with your new password.' },
            } );
        } catch ( failure ) {
            setFormError( describeCodeError( failure ) );
            setSaving( false );
        }
    };

    const sendAgain = async () => {
        setFormError( undefined );
        try {
            await apiRequest( '/auth/forgot-password', { method: 'POST', body: { email: email.trim() } } );
            setNotice( 'If it\'s been a minute since the last one, a new code is on its way.' );
        } catch ( failure ) {
            setFormError( describeCodeError( failure ) );
        }
    };

    return (
        <AuthLayout
            brandTitle="Choose a new password and get back to studying."
            highlights={HIGHLIGHTS}
            before={knownEmail
                ? undefined
                : (
                        <Link to="/login" className={`${shared.button} ${shared.ghost} ${shared.small} ${styles.back}`}>
                            <Icon name="chevron-left" />
                            Back to log in
                        </Link>
                    )}
            title="Choose a new password"
            subtitle={knownEmail
                ? `Enter the code we sent to ${knownEmail} and your new password.`
                : 'Enter your email, the code we sent to it, and your new password.'}
            alternative={(
                <>
                    Code expired?
                    {' '}
                    {email.trim()
                        ? <button type="button" className={styles.link} onClick={() => void sendAgain()}>Send a new one</button>
                        : <Link to="/forgot-password">Send a new one</Link>}
                </>
            )}
        >
            {notice && <p className={form.notice} role="status">{notice}</p>}
            {formError && <p className={form.formError} role="alert">{formError}</p>}
            <form className={form.form} onSubmit={( event ) => void onSubmit( event )} noValidate>
                {!knownEmail && (
                    <FormField field="email" label="Email" error={errors.email}>
                        <input
                            {...fieldProps( 'email', errors.email )}
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={( event ) => setEmail( event.target.value )}
                        />
                    </FormField>
                )}
                <FormField field="code" label="Code" error={errors.code}>
                    <input
                        {...fieldProps( 'code', errors.code )}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={7}
                        autoFocus={knownEmail !== undefined}
                        value={code}
                        onChange={( event ) => setCode( event.target.value.replace( /\D/g, '' ) )}
                    />
                </FormField>
                <FormField field="new-password" label="New password" hint={`At least ${MIN_PASSWORD} characters.`} error={errors.password}>
                    <PasswordInput
                        {...fieldProps( 'new-password', errors.password, 'yes' )}
                        autoComplete="new-password"
                        maxLength={128}
                        value={password}
                        onChange={( event ) => setPassword( event.target.value )}
                    />
                </FormField>
                <p className={styles.info}>
                    <Icon name="info" />
                    This signs you out on your other devices.
                </p>
                <button type="submit" className={`${shared.button} ${shared.primary} ${form.submit}`} disabled={saving}>
                    {saving ? 'Saving…' : 'Reset password'}
                </button>
            </form>
        </AuthLayout>
    );
}
