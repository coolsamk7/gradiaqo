import type { MyOrganizationJson } from '@studylog/schemas';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '../../auth/auth-context.ts';
import dialog from '../../components/Dialog.module.css';
import { Dialog } from '../../components/Dialog.tsx';
import { fieldProps } from '../../forms/field-props.ts';
import form from '../../forms/form.module.css';
import { FormField } from '../../forms/FormField.tsx';
import shared from '../../styles/shared.module.css';
import styles from './Organizations.module.css';
import { count, saveError } from './organizations.ts';

/** Asks for a name, then saves it (`save` throws to show its error). Used to create and to rename. */
function NameDialog( { title, description, initial, submit, busyLabel, onSave, onClose }: {
    title: string;
    description: string;
    initial: string;
    submit: string;
    busyLabel: string;
    onSave: ( name: string ) => Promise<void>;
    onClose: () => void;
} ) {
    const [ name, setName ] = useState( initial );
    const [ error, setError ] = useState<string>();
    const [ formError, setFormError ] = useState<string>();
    const [ saving, setSaving ] = useState( false );

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        setFormError( undefined );
        if ( !name.trim() ) {
            setError( 'Enter a name.' );

            return;
        }

        setError( undefined );
        setSaving( true );
        try {
            await onSave( name.trim() );
        } catch ( failure ) {
            setFormError( saveError( failure ) );
            setSaving( false );
        }
    };

    return (
        <Dialog title={title} description={description} onClose={onClose}>
            <form className={styles.form} onSubmit={( event ) => void onSubmit( event )} noValidate>
                {formError && <p className={`${form.formError} ${styles.flush}`} role="alert">{formError}</p>}
                <FormField field="organization-name" label="Name" error={error}>
                    <input
                        {...fieldProps( 'organization-name', error )}
                        maxLength={100}
                        autoFocus
                        value={name}
                        onChange={( event ) => setName( event.target.value )}
                    />
                </FormField>
                <div className={dialog.actions}>
                    <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={onClose}>Cancel</button>
                    <button type="submit" className={`${shared.button} ${shared.primary}`} disabled={saving}>
                        {saving ? busyLabel : submit}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}

/** Creates a shared organization with the user as owner, then opens it. */
export function NewOrganizationDialog( { onClose }: { onClose: () => void } ) {
    const { request } = useAuth();
    const navigate = useNavigate();

    return (
        <NameDialog
            title="New organization"
            description="A group to study with, e.g. friends from a bootcamp. You'll be its owner."
            initial=""
            submit="Create organization"
            busyLabel="Creating…"
            onClose={onClose}
            onSave={async ( name ) => {
                const created = await request<MyOrganizationJson>( '/organizations', { method: 'POST', body: { name } } );

                void navigate( `/app/organizations/${created.id}` );
            }}
        />
    );
}

/** Figma: Dialogs › Organization · rename. */
export function RenameOrganizationDialog( { organization, onRenamed, onClose }: {
    organization: MyOrganizationJson;
    onRenamed: () => void;
    onClose: () => void;
} ) {
    const { request } = useAuth();

    return (
        <NameDialog
            title="Rename organization"
            description="Everyone in it sees the new name."
            initial={organization.name}
            submit="Save"
            busyLabel="Saving…"
            onClose={onClose}
            onSave={async ( name ) => {
                await request( `/organizations/${organization.id}`, { method: 'PATCH', body: { name } } );
                onRenamed();
            }}
        />
    );
}

/**
 * Figma: Dialogs › Organization · delete. The owner types the name to confirm, since it deletes the organization's
 * paths for everyone.
 */
export function DeleteOrganizationDialog( { organization, members, paths, onClose }: {
    organization: MyOrganizationJson;
    members: number;
    /** Undefined while they're still loading. */
    paths: number | undefined;
    onClose: () => void;
} ) {
    const { request } = useAuth();
    const navigate = useNavigate();
    const [ typed, setTyped ] = useState( '' );
    const [ error, setError ] = useState<string>();
    const [ formError, setFormError ] = useState<string>();
    const [ deleting, setDeleting ] = useState( false );

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        setFormError( undefined );
        if ( typed.trim() !== organization.name ) {
            setError( 'Type the name exactly as it is shown.' );

            return;
        }

        setError( undefined );
        setDeleting( true );
        try {
            await request( `/organizations/${organization.id}`, { method: 'DELETE' } );
            void navigate( '/app/organizations', { replace: true } );
        } catch ( failure ) {
            setFormError( saveError( failure ) );
            setDeleting( false );
        }
    };

    return (
        <Dialog
            title={`Delete ${organization.name}?`}
            description={`This deletes the organization, its ${paths === undefined ? 'paths' : count( paths, 'path' )} and its own items for ${members === 1 ? 'you' : `all ${count( members, 'member' )}`}. Progress on catalog items is kept.`}
            onClose={onClose}
        >
            <form className={styles.form} onSubmit={( event ) => void onSubmit( event )} noValidate>
                {formError && <p className={`${form.formError} ${styles.flush}`} role="alert">{formError}</p>}
                <FormField field="confirm-name" label="Type the organization's name to confirm" error={error}>
                    <input
                        {...fieldProps( 'confirm-name', error )}
                        autoComplete="off"
                        autoFocus
                        value={typed}
                        onChange={( event ) => setTyped( event.target.value )}
                    />
                </FormField>
                <div className={dialog.actions}>
                    <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={onClose}>Cancel</button>
                    <button type="submit" className={`${shared.button} ${shared.danger}`} disabled={deleting}>
                        {deleting ? 'Deleting…' : 'Delete organization'}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}
