import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import { ApiError } from '../../api/client.ts';
import type { FieldErrors } from '../../forms/form-errors.ts';
import { focusFirstError } from '../../forms/form-errors.ts';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Builder.module.css';
import type { TopicNode } from './builder-tree.ts';
import type { ItemField, ItemValues } from './item-form.ts';
import { checkItem, emptyItem, ITEM_FIELD_ORDER, itemFieldErrors, toItemRequest } from './item-form.ts';
import { ItemFields } from './ItemFields.tsx';
import { saveErrorMessage } from './problems.ts';
import type { Send } from './use-path-builder.ts';

interface NewItemFormProps {
    topic: TopicNode;
    send: Send;
    onClose: () => void;
}

/** Creates an item in the user's catalog and adds it to the end of the topic. */
export function NewItemForm( { topic, send, onClose }: NewItemFormProps ) {
    const [ values, setValues ] = useState<ItemValues>( emptyItem );
    const [ errors, setErrors ] = useState<FieldErrors<ItemField>>( {} );
    const [ formError, setFormError ] = useState<string>();
    const [ saving, setSaving ] = useState( false );
    const set = ( change: Partial<ItemValues> ) => setValues( ( current ) => ( { ...current, ...change } ) );

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
            const item = await send<{ id: string }>( '/items', { method: 'POST', body: toItemRequest( values ) } );

            await send( `/topics/${topic.id}/items/${item.id}`, { method: 'PUT', body: {} } );
            onClose();
        } catch ( caught ) {
            const fields = caught instanceof ApiError ? itemFieldErrors( caught.fieldErrors ) : {};

            setErrors( fields );
            setFormError( Object.keys( fields ).length > 0 ? undefined : saveErrorMessage( caught ) );
            focusFirstError( ITEM_FIELD_ORDER, fields );
            setSaving( false );
        }
    };

    return (
        <section className={`${app.card} ${styles.newItem}`} aria-labelledby="new-item-title">
            <form className={styles.editor} onSubmit={( event ) => void onSubmit( event )} noValidate>
                <h2 id="new-item-title" className={styles.cardTitle}>New item</h2>
                {formError && <p className={styles.error} role="alert">{formError}</p>}

                <ItemFields values={values} errors={errors} onChange={set} />

                <div className={styles.editorActions}>
                    <button type="submit" className={`${shared.button} ${shared.primary}`} disabled={saving}>
                        {saving ? 'Adding…' : 'Add item'}
                    </button>
                    <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={onClose}>Cancel</button>
                </div>
            </form>
        </section>
    );
}
