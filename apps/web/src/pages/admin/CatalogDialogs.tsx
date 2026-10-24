import type { LearningPathJson, ManagedItemJson } from '@studylog/schemas';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { ApiError } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';
import dialog from '../../components/Dialog.module.css';
import { Dialog } from '../../components/Dialog.tsx';
import { fieldProps } from '../../forms/field-props.ts';
import form from '../../forms/form.module.css';
import type { FieldErrors } from '../../forms/form-errors.ts';
import { focusFirstError } from '../../forms/form-errors.ts';
import { FormField } from '../../forms/FormField.tsx';
import shared from '../../styles/shared.module.css';
import type { ItemField, ItemValues } from '../my-paths/item-form.ts';
import {
    checkItem,
    emptyItem,
    fromItem,
    ITEM_FIELD_ORDER,
    itemFieldErrors,
    toItemRequest,
    toItemUpdate,
} from '../my-paths/item-form.ts';
import { ItemFields } from '../my-paths/ItemFields.tsx';
import styles from './Admin.module.css';
import { changeError } from './catalog.ts';

/** Names a new official path (it starts as a draft), then opens it in the builder. */
export function NewPathDialog( { onClose }: { onClose: () => void } ) {
    const { request } = useAuth();
    const navigate = useNavigate();
    const [ title, setTitle ] = useState( '' );
    const [ description, setDescription ] = useState( '' );
    const [ titleError, setTitleError ] = useState<string>();
    const [ formError, setFormError ] = useState<string>();
    const [ saving, setSaving ] = useState( false );

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        setFormError( undefined );
        if ( !title.trim() ) {
            setTitleError( 'Enter a title.' );

            return;
        }

        setTitleError( undefined );
        setSaving( true );
        try {
            const path = await request<LearningPathJson>( '/admin/catalog/paths', {
                method: 'POST',
                body: { title: title.trim(), ...( description.trim() ? { description: description.trim() } : {} ) },
            } );

            void navigate( `/app/admin/catalog/paths/${path.id}` );
        } catch ( failure ) {
            setFormError( changeError( failure ) );
            setSaving( false );
        }
    };

    return (
        <Dialog title="New path" description="In the global catalog. It starts as a draft: learners see it once it's published." onClose={onClose}>
            <form className={styles.dialogForm} onSubmit={( event ) => void onSubmit( event )} noValidate>
                {formError && <p className={`${form.formError} ${styles.flush}`} role="alert">{formError}</p>}
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

interface ItemDialogProps {
    /** The item to edit; a new one (a draft) when undefined. */
    item?: ManagedItemJson;
    onSaved: () => void;
    onClose: () => void;
}

/** Creates or edits an official item: its type (fixed once created), title and details. */
export function ItemDialog( { item, onSaved, onClose }: ItemDialogProps ) {
    const { request } = useAuth();
    const [ values, setValues ] = useState<ItemValues>( () => ( item ? fromItem( item ) : emptyItem() ) );
    const [ errors, setErrors ] = useState<FieldErrors<ItemField>>( {} );
    const [ formError, setFormError ] = useState<string>();
    const [ saving, setSaving ] = useState( false );
    const submit = item ? 'Save changes' : 'Create item';

    useEffect( () => {
        document.getElementById( 'title' )?.focus();
    }, [] );

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();

        const problems = checkItem( values );

        setErrors( problems );
        setFormError( undefined );
        if ( Object.keys( problems ).length > 0 ) {
            focusFirstError( ITEM_FIELD_ORDER, problems );

            return;
        }

        setSaving( true );
        try {
            await ( item
                ? request( `/admin/catalog/items/${item.id}`, { method: 'PATCH', body: toItemUpdate( values ) } )
                : request( '/admin/catalog/items', { method: 'POST', body: toItemRequest( values ) } ) );
            onSaved();
        } catch ( failure ) {
            const fields = failure instanceof ApiError ? itemFieldErrors( failure.fieldErrors ) : {};

            setErrors( fields );
            setFormError( Object.keys( fields ).length > 0 ? undefined : changeError( failure ) );
            focusFirstError( ITEM_FIELD_ORDER, fields );
            setSaving( false );
        }
    };

    return (
        <Dialog
            title={item ? 'Edit item' : 'New item'}
            description={item ? 'Changes show everywhere the item is used.' : 'In the global catalog. It starts as a draft.'}
            wide
            onClose={onClose}
        >
            <form className={styles.dialogForm} onSubmit={( event ) => void onSubmit( event )} noValidate>
                {formError && <p className={`${form.formError} ${styles.flush}`} role="alert">{formError}</p>}
                <ItemFields
                    values={values}
                    errors={errors}
                    typeLocked={item !== undefined}
                    onChange={( change ) => setValues( ( current ) => ( { ...current, ...change } ) )}
                />
                <div className={dialog.actions}>
                    <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={onClose}>Cancel</button>
                    <button type="submit" className={`${shared.button} ${shared.primary}`} disabled={saving}>
                        {saving ? 'Saving…' : submit}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}
