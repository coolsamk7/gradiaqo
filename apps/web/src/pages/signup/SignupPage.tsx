import type { SignupRequest } from '@studylog/schemas';
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
import type { Field } from './signup-errors.ts';
import { describeSignupError, EMAIL_TAKEN, FIELDS, PASSWORD_MIN, validate } from './signup-errors.ts';

const PASSWORD_HINT = `At least ${PASSWORD_MIN} characters.`;

export function SignupPage() {
    const { state, signUp } = useAuth();
    const navigate = useNavigate();
    const { from = '/app' } = useAuthPageState();
    const [ details, setDetails ] = useState<SignupRequest>( { firstName: '', lastName: '', email: '', password: '' } );
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

        const errors = validate( details );

        if ( Object.keys( errors ).length > 0 ) {
            showErrors( errors );

            return;
        }

        setSubmitting( true );
        showErrors( {} );
        try {
            await signUp( {
                firstName: details.firstName.trim(),
                lastName: details.lastName.trim(),
                email: details.email.trim(),
                password: details.password,
            } );
            void navigate( from, { replace: true } );
        } catch ( error ) {
            const { form, fields } = describeSignupError( error );

            showErrors( fields, form );
            setSubmitting( false );
        }
    };

    /** The input's props, plus its value and change handler. */
    const inputProps = ( field: Field, hint?: string ) => ( {
        ...fieldProps( field, fieldErrors[field], hint ),
        value: details[field],
        onChange: ( event: { target: { value: string } } ) => {
            const { value } = event.target;

            setDetails( ( current ) => ( { ...current, [field]: value } ) );
        },
    } );

    const emailError = fieldErrors.email === EMAIL_TAKEN
        ? (
                <>
                    {EMAIL_TAKEN}
                    {' '}
                    <Link to="/login" state={{ from, email: details.email.trim() }}>Log in instead</Link>
                </>
            )
        : fieldErrors.email;

    return (
        <AuthLayout
            brandTitle="Turn what you want to learn into a plan."
            highlights={[ 'Learning paths built from topics and modules', 'Progress tracked as you go', 'Study sessions, streaks and weekly totals' ]}
            title="Create your account"
            subtitle="It takes a minute. You can start a learning path right after."
            alternative={(
                <>
                    Already have an account?
                    {' '}
                    <Link to="/login" state={{ from }}>Log in</Link>
                </>
            )}
        >
            {formError && <p className={styles.formError} role="alert">{formError}</p>}

            <form className={styles.form} onSubmit={( event ) => void onSubmit( event )} noValidate>
                <div className={styles.row}>
                    <FormField field="firstName" label="First name" error={fieldErrors.firstName}>
                        <input {...inputProps( 'firstName' )} type="text" autoComplete="given-name" />
                    </FormField>

                    <FormField field="lastName" label="Last name" error={fieldErrors.lastName}>
                        <input {...inputProps( 'lastName' )} type="text" autoComplete="family-name" />
                    </FormField>
                </div>

                <FormField field="email" label="Email" error={emailError}>
                    <input {...inputProps( 'email' )} type="email" autoComplete="email" />
                </FormField>

                <FormField field="password" label="Password" hint={PASSWORD_HINT} error={fieldErrors.password}>
                    <PasswordInput {...inputProps( 'password', PASSWORD_HINT )} autoComplete="new-password" />
                </FormField>

                <button type="submit" className={`${shared.button} ${shared.primary} ${styles.submit}`} disabled={submitting}>
                    {submitting ? 'Creating your account…' : 'Create account'}
                </button>
            </form>
        </AuthLayout>
    );
}
