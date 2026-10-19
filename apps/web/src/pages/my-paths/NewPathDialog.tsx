import type { LearningPathJson, MyOrganizationJson } from '@studylog/schemas';
import { PathVisibility } from '@studylog/schemas/enums';
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
import styles from './MyPaths.module.css';
import { saveErrorMessage } from './problems.ts';

interface NewPathDialogProps {
    organization: MyOrganizationJson;
    onClose: () => void;
}

/** Names a new path, then opens it in the builder. In the user's workspace it can be public from the start. */
export function NewPathDialog( { organization, onClose }: NewPathDialogProps ) {
    const { request } = useAuth();
    const navigate = useNavigate();
    const [ title, setTitle ] = useState( '' );
    const [ description, setDescription ] = useState( '' );
    const [ visibility, setVisibility ] = useState( PathVisibility.Private );
    const [ titleError, setTitleError ] = useState<string>();
    const [ formError, setFormError ] = useState<string>();
    const [ saving, setSaving ] = useState( false );

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        if ( !title.trim() ) {
            setTitleError( 'Enter a title.' );
            document.getElementById( 'path-title' )?.focus();

            return;
        }

        setSaving( true );
        setTitleError( undefined );
        setFormError( undefined );
        try {
            const path = await request<LearningPathJson>( `/organizations/${organization.id}/catalog/paths`, {
                method: 'POST',
                body: {
                    title: title.trim(),
                    ...( description.trim() ? { description: description.trim() } : {} ),
                    ...( organization.isPersonal ? { visibility } : {} ),
                },
            } );

            void navigate( `/app/my-paths/${organization.id}/${path.id}` );
        } catch ( error ) {
            setFormError( saveErrorMessage( error, 'You already have a path with this title. Try another.' ) );
            setSaving( false );
        }
    };

    return (
        <Dialog title="New path" description={`In ${organization.isPersonal ? 'your workspace' : organization.name}.`} onClose={onClose}>
            <form className={styles.dialogForm} onSubmit={( event ) => void onSubmit( event )} noValidate>
                {formError && <p className={form.formError} role="alert">{formError}</p>}
                <FormField field="path-title" label="Title" error={titleError}>
                    <input
                        {...fieldProps( 'path-title', titleError )}
                        maxLength={200}
                        autoFocus
                        value={title}
                        onChange={( event ) => setTitle( event.target.value )}
                    />
                </FormField>
                <FormField field="path-description" label="Description (optional)">
                    <textarea
                        {...fieldProps( 'path-description', undefined )}
                        rows={3}
                        value={description}
                        onChange={( event ) => setDescription( event.target.value )}
                    />
                </FormField>
                {organization.isPersonal && (
                    <fieldset className={styles.choices}>
                        <legend className={form.label}>Who can see it</legend>
                        <label className={styles.choice}>
                            <input
                                type="radio"
                                name="visibility"
                                checked={visibility === PathVisibility.Private}
                                onChange={() => setVisibility( PathVisibility.Private )}
                            />
                            Private: only you
                        </label>
                        <label className={styles.choice}>
                            <input
                                type="radio"
                                name="visibility"
                                checked={visibility === PathVisibility.Public}
                                onChange={() => setVisibility( PathVisibility.Public )}
                            />
                            Public: everyone, under Community in Browse paths
                        </label>
                    </fieldset>
                )}
                <div className={dialog.actions}>
                    <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={onClose}>Cancel</button>
                    <button type="submit" className={`${shared.button} ${shared.primary}`} disabled={saving}>
                        {saving ? 'Creating…' : 'Create path'}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}
