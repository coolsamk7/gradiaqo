import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';

import { useAuth } from '../../auth/auth-context.ts';
import { useAuthPageState } from '../../auth/auth-page-state.ts';
import { AuthLayout } from '../../components/AuthLayout.tsx';
import { fieldProps } from '../../forms/field-props.ts';
import styles from '../../forms/form.module.css';
import type { FieldErrors } from '../../forms/form-errors.ts';
import { focusFirstError } from '../../forms/form-errors.ts';
import { FormField } from '../../forms/FormField.tsx';
import { PasswordInput } from '../../forms/PasswordInput.tsx';
import shared from '../../styles/shared.module.css';
import type { Field } from './login-errors.ts';
import { describeLoginError, FIELDS, validate } from './login-errors.ts';

export function LoginPage() {
    const { state, logIn } = useAuth();
    const navigate = useNavigate();
    const { from = '/app', email: initialEmail = '', expired = false, notice } = useAuthPageState();
    const [ email, setEmail ] = useState( initialEmail );
    const [ password, setPassword ] = useState( '' );
    const [ fieldErrors, setFieldErrors ] = useState<FieldErrors<Field>>( {} );
    const [ formError, setFormError ] = useState<string>();
    const [ submitting, setSubmitting ] = useState( false );

    if ( state.status === 'authenticated' ) {
        return <Navigate to={from} replace />;
    }

    const showErrors = ( fields: FieldErrors<Field>, form?: string ) => {
        setFieldErrors( fields );
        setFormError( form );
        focusFirstError( FIELDS, fields );
    };

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();

        const errors = validate( email, password );

        if ( Object.keys( errors ).length > 0 ) {
            showErrors( errors );

            return;
        }

        setSubmitting( true );
        showErrors( {} );
        try {
            await logIn( email.trim(), password );
            void navigate( from, { replace: true } );
        } catch ( error ) {
            const { form, fields } = describeLoginError( error );

            showErrors( fields, form );
            setSubmitting( false );
        }
    };

    return (
        <AuthLayout
            brandTitle="Pick up right where you left off."
            highlights={[ 'Your learning paths, in your order', 'Progress on every topic and module', 'Study sessions, streaks and weekly totals' ]}
            title="Log in"
            subtitle="Welcome back. Enter your details to continue."
            alternative={(
                <>
                    New to StudyLog?
                    {' '}
                    <Link to="/signup" state={{ from }}>Create an account</Link>
                </>
            )}
        >
            {expired && !formError && <p className={styles.notice} role="status">Your session has ended. Log in again to continue.</p>}
            {notice && !formError && <p className={styles.notice} role="status">{notice}</p>}
            {formError && <p className={styles.formError} role="alert">{formError}</p>}

            <form className={styles.form} onSubmit={( event ) => void onSubmit( event )} noValidate>
                <FormField field="email" label="Email" error={fieldErrors.email}>
                    <input
                        {...fieldProps( 'email', fieldErrors.email )}
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={( event ) => setEmail( event.target.value )}
                    />
                </FormField>

                <FormField field="password" label="Password" error={fieldErrors.password}>
                    <PasswordInput
                        {...fieldProps( 'password', fieldErrors.password )}
                        autoComplete="current-password"
                        value={password}
                        onChange={( event ) => setPassword( event.target.value )}
                    />
                </FormField>
                <Link to="/forgot-password" state={{ email: email.trim() }} className={styles.forgot}>Forgot password?</Link>

                <button type="submit" className={`${shared.button} ${shared.primary} ${styles.submit}`} disabled={submitting}>
                    {submitting ? 'Logging in…' : 'Log in'}
                </button>
            </form>
        </AuthLayout>
    );
}
