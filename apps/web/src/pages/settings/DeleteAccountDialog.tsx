import type { FormEvent } from 'react';
import { useState } from 'react';

import { ApiError } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';
import dialog from '../../components/Dialog.module.css';
import { Dialog } from '../../components/Dialog.tsx';
import { Icon } from '../../components/Icon.tsx';
import { fieldProps } from '../../forms/field-props.ts';
import form from '../../forms/form.module.css';
import { FormField } from '../../forms/FormField.tsx';
import { PasswordInput } from '../../forms/PasswordInput.tsx';
import shared from '../../styles/shared.module.css';
import { isWrongPassword, saveError } from './account-forms.ts';
import styles from './Settings.module.css';

/**
 * Deletes the account after the password (Figma: Dialogs › Settings · delete account). If the user is the only
 * owner of an organization with other members, the API refuses, and the dialog says what to do instead.
 */
export function DeleteAccountDialog( { onClose }: { onClose: () => void } ) {
    const { request, accountDeleted } = useAuth();
    const [ password, setPassword ] = useState( '' );
    const [ error, setError ] = useState<string>();
    const [ formError, setFormError ] = useState<string>();
    const [ blocked, setBlocked ] = useState<string>();
    const [ deleting, setDeleting ] = useState( false );

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        setFormError( undefined );
        if ( !password ) {
            setError( 'Enter your password.' );

            return;
        }

        setDeleting( true );
        setError( undefined );
        try {
            await request( '/auth/delete-account', { method: 'POST', body: { password } } );
            // The page then goes to the homepage (see RequireAuth).
            accountDeleted();
        } catch ( failure ) {
            if ( isWrongPassword( failure ) ) {
                setError( 'That isn\'t your password.' );
            } else if ( failure instanceof ApiError && failure.status === 409 ) {
                setBlocked( failure.message );
            } else {
                setFormError( saveError( failure ) );
            }
            setDeleting( false );
        }
    };

    if ( blocked ) {
        return (
            <Dialog title="Hand over your organization first" description="Your account wasn't deleted." onClose={onClose}>
                <p className={styles.warning} role="alert">
                    <Icon name="info" />
                    {`${blocked.replace( /:.*$/, '' )}, which has other members. Make someone else an owner, or delete the organization, before deleting your account.`}
                </p>
                <div className={dialog.actions}>
                    <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={onClose}>Close</button>
                </div>
            </Dialog>
        );
    }

    return (
        <Dialog
            title="Delete your account?"
            description="This permanently deletes your workspace, your own paths and items, and your enrollments, progress and study sessions. It can't be undone."
            onClose={onClose}
        >
            <form className={styles.form} onSubmit={( event ) => void onSubmit( event )} noValidate>
                {formError && <p className={`${form.formError} ${styles.flush}`} role="alert">{formError}</p>}
                <FormField field="delete-password" label="Password" hint="Enter your password to confirm." error={error}>
                    <PasswordInput
                        {...fieldProps( 'delete-password', error, 'yes' )}
                        autoComplete="current-password"
                        autoFocus
                        value={password}
                        onChange={( event ) => setPassword( event.target.value )}
                    />
                </FormField>
                <div className={dialog.actions}>
                    <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={onClose}>Cancel</button>
                    <button type="submit" className={`${shared.button} ${shared.danger}`} disabled={deleting}>
                        {deleting ? 'Deleting…' : 'Delete account'}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}
