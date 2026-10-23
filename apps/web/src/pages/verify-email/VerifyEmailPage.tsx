import type { UserJson } from '@studylog/schemas';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';

import { useAuth } from '../../auth/auth-context.ts';
import { useAuthPageState } from '../../auth/auth-page-state.ts';
import { AuthLayout } from '../../components/AuthLayout.tsx';
import { describeCodeError, formatCountdown } from '../../forms/code-errors.ts';
import { CODE_LENGTH, CodeInput } from '../../forms/CodeInput.tsx';
import form from '../../forms/form.module.css';
import shared from '../../styles/shared.module.css';
import styles from './VerifyEmail.module.css';

/** How long to wait before another code can be sent (the API refuses sooner). */
export const RESEND_SECONDS = 60;

const HIGHLIGHTS = [ 'Codes expire after 15 minutes', 'We never share your email', 'You can keep using StudyLog meanwhile' ];

/**
 * Entering the code emailed after signup (Figma: M3 › Verify email). Until then the app shows a banner that links
 * here; afterwards the user goes back to where they were.
 */
export function VerifyEmailPage() {
    const { state, request, updateUser } = useAuth();
    const navigate = useNavigate();
    const { from = '/app' } = useAuthPageState();
    const [ code, setCode ] = useState( '' );
    const [ error, setError ] = useState<string>();
    const [ notice, setNotice ] = useState<string>();
    const [ verifying, setVerifying ] = useState( false );
    const [ wait, setWait ] = useState( 0 );
    // Only rendered inside <RequireAuth>, so there is a session.
    const { user } = ( state as Extract<typeof state, { status: 'authenticated' }> ).session;

    // Counts down to when "Resend code" works again.
    useEffect( () => {
        if ( wait === 0 ) {
            return undefined;
        }

        const timer = setTimeout( () => setWait( wait - 1 ), 1000 );

        return () => clearTimeout( timer );
    }, [ wait ] );

    if ( user.emailVerifiedAt ) {
        return <Navigate to={from} replace />;
    }

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        setNotice( undefined );
        if ( code.length < CODE_LENGTH ) {
            setError( 'Enter all 6 digits of the code.' );

            return;
        }

        setVerifying( true );
        setError( undefined );
        try {
            updateUser( await request<UserJson>( '/auth/verify-email', { method: 'POST', body: { code } } ) );
            void navigate( from, { replace: true } );
        } catch ( failure ) {
            setError( describeCodeError( failure ) );
            setCode( '' );
            setVerifying( false );
        }
    };

    const resend = async () => {
        setError( undefined );
        setNotice( undefined );
        try {
            await request( '/auth/verify-email/resend', { method: 'POST' } );
            setNotice( `We sent a new code to ${user.email}.` );
            setCode( '' );
            setWait( RESEND_SECONDS );
        } catch ( failure ) {
            setError( describeCodeError( failure ) );
        }
    };

    return (
        <AuthLayout
            brandTitle="One last step: confirm it's you."
            highlights={HIGHLIGHTS}
            chip="mail"
            title="Check your inbox"
            subtitle={`We sent a 6-digit code to ${user.email}. Enter it below to verify your email.`}
            alternative={(
                <>
                    Wrong address?
                    {' '}
                    <Link to="/app/settings" state={{ changeEmail: true }}>Use a different email</Link>
                    {' · '}
                    <Link to={from}>Not now</Link>
                </>
            )}
        >
            {notice && <p className={form.notice} role="status">{notice}</p>}
            {error && <p className={form.formError} role="alert">{error}</p>}
            <form className={form.form} onSubmit={( event ) => void onSubmit( event )} noValidate>
                <CodeInput value={code} onChange={setCode} label="Verification code" invalid={error !== undefined} autoFocus />
                <button type="submit" className={`${shared.button} ${shared.primary} ${form.submit}`} disabled={verifying}>
                    {verifying ? 'Verifying…' : 'Verify email'}
                </button>
            </form>
            <p className={styles.resend}>
                Didn&apos;t get it?
                {' '}
                {wait > 0
                    ? <span className={styles.wait}>{`Resend code in ${formatCountdown( wait )}`}</span>
                    : <button type="button" className={styles.link} onClick={() => void resend()}>Resend code</button>}
            </p>
        </AuthLayout>
    );
}
