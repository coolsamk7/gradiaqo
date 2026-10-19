import { ItemType } from '@studylog/schemas/enums';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import { ApiError } from '../../api/client.ts';
import { fieldProps } from '../../forms/field-props.ts';
import type { FieldErrors } from '../../forms/form-errors.ts';
import { focusFirstError } from '../../forms/form-errors.ts';
import { FormField } from '../../forms/FormField.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import { DIFFICULTY_LABELS, TYPE_LABELS } from '../path/item-details.ts';
import styles from './Builder.module.css';
import type { TopicNode } from './builder-tree.ts';
import type { ItemField, ItemValues } from './item-form.ts';
import { checkItem, DETAIL_INPUTS, DIFFICULTIES, emptyItem, HAS_DIFFICULTY, itemFieldErrors, toItemRequest } from './item-form.ts';
import { saveErrorMessage } from './problems.ts';
import type { Send } from './use-path-builder.ts';

const ORDER: ItemField[] = [ 'title', 'url', 'author', 'provider', 'content', 'instructions', 'answer', 'difficulty', 'minutes' ];

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
    const inputs = DETAIL_INPUTS[values.type];
    const field = ( name: ItemField ) => ( { ...fieldProps( name, errors[name] ), value: values[name] } );

    useEffect( () => {
        document.getElementById( 'title' )?.focus();
    }, [] );

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();

        const problems = checkItem( values );

        setErrors( problems );
        setFormError( undefined );
        if ( Object.keys( problems ).length > 0 ) {
            focusFirstError( ORDER, problems );

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
            focusFirstError( ORDER, fields );
            setSaving( false );
        }
    };

    return (
        <section className={`${app.card} ${styles.newItem}`} aria-labelledby="new-item-title">
            <form className={styles.editor} onSubmit={( event ) => void onSubmit( event )} noValidate>
                <h2 id="new-item-title" className={styles.cardTitle}>New item</h2>
                {formError && <p className={styles.error} role="alert">{formError}</p>}

                <div className={styles.typeRow}>
                    <FormField field="type" label="Type">
                        <select
                            {...fieldProps( 'type', undefined )}
                            value={values.type}
                            onChange={( event ) => set( { type: event.target.value as ItemType } )}
                        >
                            {Object.values( ItemType ).map( ( type ) => (
                                <option key={type} value={type}>{TYPE_LABELS[type]}</option>
                            ) )}
                        </select>
                    </FormField>
                    <FormField field="title" label="Title" error={errors.title}>
                        <input {...field( 'title' )} maxLength={300} onChange={( event ) => set( { title: event.target.value } )} />
                    </FormField>
                </div>

                {inputs.filter( ( input ) => input.long ).map( ( input ) => (
                    <FormField key={input.field} field={input.field} label={input.label} error={errors[input.field]}>
                        <textarea
                            {...field( input.field )}
                            rows={4}
                            onChange={( event ) => set( { [input.field]: event.target.value } )}
                        />
                    </FormField>
                ) )}

                <div className={styles.detailsRow}>
                    {inputs.filter( ( input ) => !input.long ).map( ( input ) => (
                        <div key={input.field} className={styles.grow}>
                            <FormField field={input.field} label={input.label} error={errors[input.field]}>
                                <input
                                    {...field( input.field )}
                                    type={input.field === 'url' ? 'url' : 'text'}
                                    placeholder={input.field === 'url' ? 'https://' : undefined}
                                    onChange={( event ) => set( { [input.field]: event.target.value } )}
                                />
                            </FormField>
                        </div>
                    ) )}
                    {HAS_DIFFICULTY.has( values.type ) && (
                        <FormField field="difficulty" label="Difficulty">
                            <select {...field( 'difficulty' )} onChange={( event ) => set( { difficulty: event.target.value } )}>
                                <option value="">Not set</option>
                                {DIFFICULTIES.map( ( difficulty ) => (
                                    <option key={difficulty} value={difficulty}>{DIFFICULTY_LABELS[difficulty]}</option>
                                ) )}
                            </select>
                        </FormField>
                    )}
                    <FormField field="minutes" label="Minutes (optional)" error={errors.minutes}>
                        <input {...field( 'minutes' )} inputMode="numeric" onChange={( event ) => set( { minutes: event.target.value } )} />
                    </FormField>
                </div>

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
