import { ItemType } from '@studylog/schemas/enums';

import { fieldProps } from '../../forms/field-props.ts';
import type { FieldErrors } from '../../forms/form-errors.ts';
import { FormField } from '../../forms/FormField.tsx';
import { DIFFICULTY_LABELS, TYPE_LABELS } from '../path/item-details.ts';
import styles from './Builder.module.css';
import type { ItemField, ItemValues } from './item-form.ts';
import { DETAIL_INPUTS, DIFFICULTIES, HAS_DIFFICULTY } from './item-form.ts';

interface ItemFieldsProps {
    values: ItemValues;
    errors: FieldErrors<ItemField>;
    onChange: ( change: Partial<ItemValues> ) => void;
    /** An item's type can't change once it exists. */
    typeLocked?: boolean;
}

/** An item's type, title and the details its type has (link, author, note…), plus difficulty and minutes. */
export function ItemFields( { values, errors, onChange: set, typeLocked = false }: ItemFieldsProps ) {
    const inputs = DETAIL_INPUTS[values.type];
    const field = ( name: ItemField ) => ( { ...fieldProps( name, errors[name] ), value: values[name] } );

    return (
        <>
            <div className={styles.typeRow}>
                <FormField field="type" label="Type">
                    <select
                        {...fieldProps( 'type', undefined )}
                        disabled={typeLocked}
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
        </>
    );
}
