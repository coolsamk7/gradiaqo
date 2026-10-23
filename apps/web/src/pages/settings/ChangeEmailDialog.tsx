import type { UserJson } from '@studylog/schemas';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import { ApiError } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';
import dialog from '../../components/Dialog.module.css';
import { Dialog } from '../../components/Dialog.tsx';
import { Icon } from '../../components/Icon.tsx';
import { describeCodeError, formatCountdown } from '../../forms/code-errors.ts';
import { fieldProps } from '../../forms/field-props.ts';
import form from '../../forms/form.module.css';
import { FormField } from '../../forms/FormField.tsx';
import { PasswordInput } from '../../forms/PasswordInput.tsx';
import shared from '../../styles/shared.module.css';
import { isEmail } from '../password-reset/reset.ts';
import { RESEND_SECONDS } from '../verify-email/VerifyEmailPage.tsx';
import { isWrongPassword } from './account-forms.ts';
import styles from './Settings.module.css';

interface AddressErrors {
    newEmail?: string;
    password?: string;
}

/**
 * Changing the email (Figma: Dialogs › Settings · change email): the new address and the password, then the code
 * sent to the new address. Nothing changes until the code is entered. `onChanged` gets the new address.
 */
interface ChangeEmailDialogProps {
    onClose: () => void;
    onChanged: ( email: string ) => void;
}

export function ChangeEmailDialog( { onClose, onChanged }: ChangeEmailDialogProps ) {
    const { request, updateUser } = useAuth();
    const [ newEmail, setNewEmail ] = useState( '' );
    const [ password, setPassword ] = useState( '' );
    const [ errors, setErrors ] = useState<AddressErrors>( {} );
    // The address the code went to; until then, the first step.
    const [ sentTo, setSentTo ] = useState<string>();
    const [ code, setCode ] = useState( '' );
    const [ codeError, setCodeError ] = useState<string>();
    const [ formError, setFormError ] = useState<string>();
    const [ busy, setBusy ] = useState( false );
    const [ wait, setWait ] = useState( 0 );

    // Counts down to when "Resend code" works again.
    useEffect( () => {
        if ( wait === 0 ) {
            return undefined;
        }

        const timer = setTimeout( () => setWait( wait - 1 ), 1000 );

        return () => clearTimeout( timer );
    }, [ wait ] );

    /**
     * Emails a code to the new address. Problems with the address or password go on the first step's fields
     * ("fields"); others, like "wait a minute", on the form ("form").
     */
    const sendCode = async ( email: string ): Promise<'sent' | 'fields' | 'form'> => {
        try {
            await request( '/auth/change-email', { method: 'POST', body: { newEmail: email, password } } );
            setWait( RESEND_SECONDS );

            return 'sent';
        } catch ( failure ) {
            if ( isWrongPassword( failure ) ) {
                setErrors( { password: 'That isn\'t your password.' } );
            } else if ( failure instanceof ApiError && failure.fieldErrors.newEmail ) {
                setErrors( { newEmail: 'Enter a valid email address.' } );
            } else if ( failure instanceof ApiError && [ 400, 409 ].includes( failure.status ) ) {
                setErrors( { newEmail: `${failure.message}.` } );
            } else {
                setFormError( describeCodeError( failure ) );

                return 'form';
            }

            return 'fields';
        }
    };

    const onRequest = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        const email = newEmail.trim().toLowerCase();
        const found: AddressErrors = {
            ...( isEmail( email ) ? {} : { newEmail: 'Enter a valid email address.' } ),
            ...( password ? {} : { password: 'Enter your password.' } ),
        };

        setErrors( found );
        setFormError( undefined );
        if ( found.newEmail || found.password ) {
            document.getElementById( found.newEmail ? 'new-email' : 'change-email-password' )?.focus();

            return;
        }

        setBusy( true );
        if ( await sendCode( email ) === 'sent' ) {
            setSentTo( email );
        }
        setBusy( false );
    };

    const onConfirm = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        const digits = code.replace( /\s/g, '' );

        setFormError( undefined );
        if ( !/^\d{6}$/.test( digits ) ) {
            setCodeError( 'Enter the 6-digit code from the email.' );

            return;
        }

        setBusy( true );
        setCodeError( undefined );
        try {
            const user = await request<UserJson>( '/auth/change-email/confirm', { method: 'POST', body: { code: digits } } );

            updateUser( user );
            onChanged( user.email );
        } catch ( failure ) {
            if ( failure instanceof ApiError && failure.status === 409 ) {
                setFormError( `${failure.message}. Choose another address.` );
            } else if ( failure instanceof ApiError && failure.status === 400 ) {
                setCodeError( describeCodeError( failure ) );
            } else {
                setFormError( describeCodeError( failure ) );
            }
            setBusy( false );
        }
    };

    const resend = async () => {
        setCodeError( undefined );
        setFormError( undefined );
        setCode( '' );
        if ( await sendCode( sentTo! ) === 'fields' ) {
            // E.g. the address was taken meanwhile: back to the first step, where the error shows.
            setSentTo( undefined );
        }
    };

    return (
        <Dialog
            title="Change your email"
            description="You'll log in with the new address. We check it first with a code."
            onClose={onClose}
        >
            {sentTo === undefined
                ? (
                        <form className={styles.form} onSubmit={( event ) => void onRequest( event )} noValidate>
                            {formError && <p className={`${form.formError} ${styles.flush}`} role="alert">{formError}</p>}
                            <FormField field="new-email" label="New email" error={errors.newEmail}>
                                <input
                                    {...fieldProps( 'new-email', errors.newEmail )}
                                    type="email"
                                    autoComplete="email"
                                    autoFocus
                                    maxLength={255}
                                    value={newEmail}
                                    onChange={( event ) => setNewEmail( event.target.value )}
                                />
                            </FormField>
                            <FormField field="change-email-password" label="Password" hint="Enter your password to confirm it's you." error={errors.password}>
                                <PasswordInput
                                    {...fieldProps( 'change-email-password', errors.password, 'yes' )}
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={( event ) => setPassword( event.target.value )}
                                />
                            </FormField>
                            <div className={dialog.actions}>
                                <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={onClose}>Cancel</button>
                                <button type="submit" className={`${shared.button} ${shared.primary}`} disabled={busy}>
                                    {busy ? 'Sending…' : 'Send code'}
                                </button>
                            </div>
                        </form>
                    )
                : (
                        <form className={styles.form} onSubmit={( event ) => void onConfirm( event )} noValidate>
                            {formError && <p className={`${form.formError} ${styles.flush}`} role="alert">{formError}</p>}
                            <FormField field="new-email" label="New email">
                                <input {...fieldProps( 'new-email', undefined )} type="email" value={sentTo} disabled readOnly />
                            </FormField>
                            <p className={styles.info} role="status">
                                <Icon name="info" />
                                {`We sent a 6-digit code to ${sentTo}. It expires in 15 minutes.`}
                            </p>
                            <div className={form.field}>
                                <label htmlFor="email-code" className={form.label}>Code</label>
                                <input
                                    {...fieldProps( 'email-code', codeError, 'yes' )}
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    autoFocus
                                    maxLength={12}
                                    value={code}
                                    onChange={( event ) => setCode( event.target.value )}
                                />
                                <p id="email-code-hint" className={form.hint}>
                                    Didn&apos;t get it?
                                    {' '}
                                    {wait > 0
                                        ? `Resend code in ${formatCountdown( wait )}`
                                        : <button type="button" className={styles.link} onClick={() => void resend()}>Resend code</button>}
                                </p>
                                {codeError && <p id="email-code-error" className={form.fieldError}>{codeError}</p>}
                            </div>
                            <div className={dialog.actions}>
                                <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={onClose}>Cancel</button>
                                <button type="submit" className={`${shared.button} ${shared.primary}`} disabled={busy}>
                                    {busy ? 'Confirming…' : 'Confirm new email'}
                                </button>
                            </div>
                        </form>
                    )}
        </Dialog>
    );
}
