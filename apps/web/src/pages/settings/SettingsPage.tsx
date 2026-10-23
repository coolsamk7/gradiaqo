import type { UserJson } from '@studylog/schemas';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { useLocation } from 'react-router';

import { ApiError } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';
import { AppLayout } from '../../components/AppLayout.tsx';
import { formatMonth } from '../../format/format.ts';
import { fieldProps } from '../../forms/field-props.ts';
import form from '../../forms/form.module.css';
import { FormField } from '../../forms/FormField.tsx';
import { PasswordInput } from '../../forms/PasswordInput.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import type { PasswordErrors, ProfileErrors } from './account-forms.ts';
import { isWrongPassword, MIN_PASSWORD, saveError, validatePassword, validateProfile } from './account-forms.ts';
import { ChangeEmailDialog } from './ChangeEmailDialog.tsx';
import { DeleteAccountDialog } from './DeleteAccountDialog.tsx';
import styles from './Settings.module.css';

/**
 * The user's account (Figma: M1 › Account settings): their name, email, password, and deleting the account.
 * Reminders and data export come with the features behind them. Opened with `{ changeEmail: true }` as router
 * state (from Verify email's "Use a different email"), it starts with the change-email dialog open.
 */
export function SettingsPage() {
    const { state: auth } = useAuth();
    // Only rendered inside <RequireAuth>, so there is a session.
    const { user } = ( auth as Extract<typeof auth, { status: 'authenticated' }> ).session;
    const [ deleting, setDeleting ] = useState( false );

    return (
        <AppLayout>
            <div className={app.titleBlock}>
                <h1 className={app.title}>Settings</h1>
                <p className={app.muted}>Your profile, password and account.</p>
            </div>
            <div className={styles.cards}>
                <ProfileCard user={user} />
                <PasswordCard />
                <section className={`${app.card} ${styles.row} ${styles.danger}`} aria-labelledby="delete-title">
                    <div className={styles.copy}>
                        <h2 id="delete-title" className={app.cardTitle}>Delete account</h2>
                        <p className={`${app.muted} ${app.small}`}>
                            Deletes your workspace, your own paths, enrollments, progress and sessions. If
                            you&apos;re the only owner of an organization with other members, hand it over first.
                        </p>
                    </div>
                    <button type="button" className={`${shared.button} ${shared.danger}`} onClick={() => setDeleting( true )}>
                        Delete account
                    </button>
                </section>
            </div>
            {deleting && <DeleteAccountDialog onClose={() => setDeleting( false )} />}
        </AppLayout>
    );
}

function ProfileCard( { user }: { user: UserJson } ) {
    const { request, updateUser } = useAuth();
    const [ firstName, setFirstName ] = useState( user.firstName );
    const [ lastName, setLastName ] = useState( user.lastName );
    const [ errors, setErrors ] = useState<ProfileErrors>( {} );
    const [ formError, setFormError ] = useState<string>();
    const [ saved, setSaved ] = useState( false );
    const [ saving, setSaving ] = useState( false );
    const { state: routeState } = useLocation() as { state: { changeEmail?: boolean } | null };
    const [ changingEmail, setChangingEmail ] = useState( routeState?.changeEmail === true );
    const [ emailChanged, setEmailChanged ] = useState<string>();

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        const found = validateProfile( firstName, lastName );

        setErrors( found );
        setSaved( false );
        setFormError( undefined );
        if ( found.firstName || found.lastName ) {
            document.getElementById( found.firstName ? 'first-name' : 'last-name' )?.focus();

            return;
        }

        setSaving( true );
        try {
            updateUser( await request<UserJson>( '/auth/me', {
                method: 'PATCH',
                body: { firstName: firstName.trim(), lastName: lastName.trim() },
            } ) );
            setSaved( true );
        } catch ( error ) {
            const fields = error instanceof ApiError ? error.fieldErrors : {};

            setErrors( { firstName: fields.firstName, lastName: fields.lastName } );
            setFormError( fields.firstName || fields.lastName ? undefined : saveError( error ) );
        }
        setSaving( false );
    };

    return (
        <section className={app.card} aria-labelledby="profile-title">
            <h2 id="profile-title" className={`${app.cardTitle} ${styles.cardTitle}`}>Profile</h2>
            <div className={styles.who}>
                <span className={styles.avatar} aria-hidden="true">{`${user.firstName.charAt( 0 )}${user.lastName.charAt( 0 )}`.toUpperCase()}</span>
                <div>
                    <p className={styles.name}>{`${user.firstName} ${user.lastName}`}</p>
                    <p className={`${app.muted} ${app.small}`}>{`Member since ${formatMonth( user.createdAt )}`}</p>
                </div>
            </div>
            <form className={styles.form} onSubmit={( event ) => void onSubmit( event )} noValidate>
                {formError && <p className={`${form.formError} ${styles.flush}`} role="alert">{formError}</p>}
                <div className={styles.pair}>
                    <FormField field="first-name" label="First name" error={errors.firstName}>
                        <input
                            {...fieldProps( 'first-name', errors.firstName )}
                            autoComplete="given-name"
                            maxLength={100}
                            value={firstName}
                            onChange={( event ) => setFirstName( event.target.value )}
                        />
                    </FormField>
                    <FormField field="last-name" label="Last name" error={errors.lastName}>
                        <input
                            {...fieldProps( 'last-name', errors.lastName )}
                            autoComplete="family-name"
                            maxLength={100}
                            value={lastName}
                            onChange={( event ) => setLastName( event.target.value )}
                        />
                    </FormField>
                </div>
                <div className={styles.email}>
                    <FormField field="email" label="Email">
                        <input {...fieldProps( 'email', undefined )} type="email" value={user.email} disabled readOnly />
                    </FormField>
                    <button
                        type="button"
                        className={`${shared.button} ${shared.secondary}`}
                        onClick={() => {
                            setEmailChanged( undefined );
                            setChangingEmail( true );
                        }}
                    >
                        Change email
                    </button>
                </div>
                {emailChanged && <p className={styles.saved} role="status">{`Email changed. Log in with ${emailChanged} from now on.`}</p>}
                <div className={styles.actions}>
                    <button type="submit" className={`${shared.button} ${shared.primary}`} disabled={saving}>
                        {saving ? 'Saving…' : 'Save changes'}
                    </button>
                    {saved && <p className={styles.saved} role="status">Saved.</p>}
                </div>
            </form>
            {changingEmail && (
                <ChangeEmailDialog
                    onClose={() => setChangingEmail( false )}
                    onChanged={( email ) => {
                        setChangingEmail( false );
                        setEmailChanged( email );
                    }}
                />
            )}
        </section>
    );
}

function PasswordCard() {
    const { request } = useAuth();
    const [ currentPassword, setCurrentPassword ] = useState( '' );
    const [ newPassword, setNewPassword ] = useState( '' );
    const [ errors, setErrors ] = useState<PasswordErrors>( {} );
    const [ formError, setFormError ] = useState<string>();
    const [ saved, setSaved ] = useState( false );
    const [ saving, setSaving ] = useState( false );

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        const found = validatePassword( currentPassword, newPassword );

        setErrors( found );
        setSaved( false );
        setFormError( undefined );
        if ( found.currentPassword || found.newPassword ) {
            document.getElementById( found.currentPassword ? 'current-password' : 'new-password' )?.focus();

            return;
        }

        setSaving( true );
        try {
            await request( '/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } } );
            setCurrentPassword( '' );
            setNewPassword( '' );
            setSaved( true );
        } catch ( error ) {
            if ( isWrongPassword( error ) ) {
                setErrors( { currentPassword: 'That isn\'t your current password.' } );
                document.getElementById( 'current-password' )?.focus();
            } else {
                setFormError( saveError( error ) );
            }
        }
        setSaving( false );
    };

    return (
        <section className={app.card} aria-labelledby="password-title">
            <div className={styles.cardHead}>
                <h2 id="password-title" className={app.cardTitle}>Password</h2>
                <p className={`${app.muted} ${app.small}`}>Changing your password signs you out on your other devices.</p>
            </div>
            <form className={styles.form} onSubmit={( event ) => void onSubmit( event )} noValidate>
                {formError && <p className={`${form.formError} ${styles.flush}`} role="alert">{formError}</p>}
                <div className={styles.pair}>
                    <FormField field="current-password" label="Current password" error={errors.currentPassword}>
                        <PasswordInput
                            {...fieldProps( 'current-password', errors.currentPassword )}
                            autoComplete="current-password"
                            value={currentPassword}
                            onChange={( event ) => setCurrentPassword( event.target.value )}
                        />
                    </FormField>
                    <FormField field="new-password" label="New password" hint={`At least ${MIN_PASSWORD} characters.`} error={errors.newPassword}>
                        <PasswordInput
                            {...fieldProps( 'new-password', errors.newPassword, 'yes' )}
                            autoComplete="new-password"
                            maxLength={128}
                            value={newPassword}
                            onChange={( event ) => setNewPassword( event.target.value )}
                        />
                    </FormField>
                </div>
                <div className={styles.actions}>
                    <button type="submit" className={`${shared.button} ${shared.secondary}`} disabled={saving}>
                        {saving ? 'Updating…' : 'Update password'}
                    </button>
                    {saved && <p className={styles.saved} role="status">Password changed. You&apos;re signed out on your other devices.</p>}
                </div>
            </form>
        </section>
    );
}
