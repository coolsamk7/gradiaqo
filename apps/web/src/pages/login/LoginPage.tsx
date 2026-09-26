import type { FormEvent } from 'react';
import { useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';

import { useAuth } from '../../auth/auth-context.ts';
import { Logo } from '../../components/Logo.tsx';
import shared from '../../styles/shared.module.css';
import type { Field, FieldErrors } from './login-errors.ts';
import { describeLoginError, validate } from './login-errors.ts';
import styles from './LoginPage.module.css';

/** Where to go after logging in: back to the page that sent the user here, or the app. */
function useReturnPath(): string {
    const { state } = useLocation() as { state: { from?: string } | null };

    return state?.from ?? '/app';
}

export function LoginPage() {
    const { state, logIn } = useAuth();
    const navigate = useNavigate();
    const returnPath = useReturnPath();
    const [ email, setEmail ] = useState( '' );
    const [ password, setPassword ] = useState( '' );
    const [ showPassword, setShowPassword ] = useState( false );
    const [ fieldErrors, setFieldErrors ] = useState<FieldErrors>( {} );
    const [ formError, setFormError ] = useState<string>();
    const [ submitting, setSubmitting ] = useState( false );
    const emailRef = useRef<HTMLInputElement>( null );
    const passwordRef = useRef<HTMLInputElement>( null );

    if ( state.status === 'authenticated' ) {
        return <Navigate to={returnPath} replace />;
    }

    /** Shows the errors and moves focus to the first field with one, so keyboard and screen reader users land on it. */
    const showErrors = ( fields: FieldErrors, form?: string ) => {
        setFieldErrors( fields );
        setFormError( form );

        if ( fields.email ) {
            emailRef.current?.focus();
        } else if ( fields.password ) {
            passwordRef.current?.focus();
        }
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
            void navigate( returnPath, { replace: true } );
        } catch ( error ) {
            const { form, fields } = describeLoginError( error );

            showErrors( fields, form );
            setSubmitting( false );
        }
    };

    const fieldProps = ( field: Field ) => ( {
        id: field,
        name: field,
        className: styles.input,
        'aria-invalid': fieldErrors[field] ? true : undefined,
        'aria-describedby': fieldErrors[field] ? `${field}-error` : undefined,
    } );

    return (
        <div className={styles.page}>
            <aside className={styles.brand} aria-hidden="true">
                <Logo />
                <p className={styles.brandTitle}>Pick up right where you left off.</p>
                <ul className={styles.highlights}>
                    <li>Your learning paths, in your order</li>
                    <li>Progress on every topic and module</li>
                    <li>Study sessions, streaks and weekly totals</li>
                </ul>
            </aside>

            <main className={styles.main}>
                <div className={styles.card}>
                    <Link to="/" className={styles.logoLink} aria-label="StudyLog home">
                        <Logo />
                    </Link>
                    <h1 className={styles.title}>Log in</h1>
                    <p className={styles.subtitle}>Welcome back. Enter your details to continue.</p>

                    {formError && <p className={styles.formError} role="alert">{formError}</p>}

                    <form className={styles.form} onSubmit={( event ) => void onSubmit( event )} noValidate>
                        <div className={styles.field}>
                            <label htmlFor="email" className={styles.label}>Email</label>
                            <input
                                {...fieldProps( 'email' )}
                                ref={emailRef}
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={( event ) => setEmail( event.target.value )}
                            />
                            {fieldErrors.email && <p id="email-error" className={styles.fieldError}>{fieldErrors.email}</p>}
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="password" className={styles.label}>Password</label>
                            <div className={styles.passwordRow}>
                                <input
                                    {...fieldProps( 'password' )}
                                    ref={passwordRef}
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={( event ) => setPassword( event.target.value )}
                                />
                                <button
                                    type="button"
                                    className={styles.toggle}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    aria-pressed={showPassword}
                                    onClick={() => setShowPassword( ( shown ) => !shown )}
                                >
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                            {fieldErrors.password && <p id="password-error" className={styles.fieldError}>{fieldErrors.password}</p>}
                        </div>

                        <button type="submit" className={`${shared.button} ${shared.primary} ${styles.submit}`} disabled={submitting}>
                            {submitting ? 'Logging in…' : 'Log in'}
                        </button>
                    </form>

                    <p className={styles.alternative}>
                        New to StudyLog?
                        {' '}
                        <Link to="/signup">Create an account</Link>
                    </p>
                </div>
            </main>
        </div>
    );
}
