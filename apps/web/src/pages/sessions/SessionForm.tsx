import type { StudySessionJson } from '@studylog/schemas';
import type { FormEvent } from 'react';
import { useState } from 'react';

import { useAuth } from '../../auth/auth-context.ts';
import { toDateInput } from '../../format/format.ts';
import { fieldProps } from '../../forms/field-props.ts';
import form from '../../forms/form.module.css';
import type { FieldErrors } from '../../forms/form-errors.ts';
import { focusFirstError } from '../../forms/form-errors.ts';
import { FormField } from '../../forms/FormField.tsx';
import shared from '../../styles/shared.module.css';
import type { Field, SessionFormValues } from './session-form.ts';
import {
    describeSaveError,
    editSessionValues,
    FIELDS,
    MAX_DURATION_MINUTES,
    newSessionValues,
    toCreateRequest,
    toUpdateRequest,
    validate,
} from './session-form.ts';
import styles from './Sessions.module.css';
import type { StudyOptions } from './use-study-options.ts';
import { useStudyOptions } from './use-study-options.ts';

type SessionFormProps =
    /** Log a new session; `initial` can choose what it's about (e.g. "Log time" on an item). */
    | {
        session?: undefined;
        initial?: Partial<SessionFormValues>;
        onSaved: ( message: string ) => void;
        onCancel: () => void;
    }
    /** Edit when, how long and notes of an existing one; `about` says what it was about. */
    | { session: StudySessionJson; about: string; onSaved: ( message: string ) => void; onCancel: () => void };

/** Logs a new study session, or edits one. Calls `onSaved` with a message to show once the API has it. */
export function SessionForm( props: SessionFormProps ) {
    const { request } = useAuth();
    const editing = props.session !== undefined;
    const [ values, setValues ] = useState<SessionFormValues>( () =>
        props.session
            ? editSessionValues( props.session )
            : { ...newSessionValues( new Date() ), ...props.initial } );
    const [ fieldErrors, setFieldErrors ] = useState<FieldErrors<Field>>( {} );
    const [ formError, setFormError ] = useState<string>();
    const [ saving, setSaving ] = useState( false );
    const options = useStudyOptions( values.path, !editing );
    // Logging needs a learning path to log against.
    const canSave = editing || ( options.paths.status === 'ready' && options.paths.value.length > 0 );
    const set = ( changes: Partial<SessionFormValues> ) => setValues( ( current ) => ( { ...current, ...changes } ) );
    const field = ( name: Field, hint?: string ) => fieldProps( name, fieldErrors[name], hint );

    const showErrors = ( fields: FieldErrors<Field>, message?: string ) => {
        setFieldErrors( fields );
        setFormError( message );
        focusFirstError( FIELDS, fields );
    };

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();

        const errors = validate( values, new Date(), { choosesTopic: !editing } );

        if ( Object.keys( errors ).length > 0 ) {
            showErrors( errors );

            return;
        }

        setSaving( true );
        showErrors( {} );
        try {
            if ( props.session ) {
                await request( `/me/study-sessions/${props.session.id}`, { method: 'PATCH', body: toUpdateRequest( values ) } );
                props.onSaved( 'Changes saved.' );
            } else {
                await request( '/me/study-sessions', { method: 'POST', body: toCreateRequest( values ) } );
                props.onSaved( 'Session logged.' );
            }
        } catch ( error ) {
            const { form: message, fields } = describeSaveError( error, { editing } );

            showErrors( fields, message );
            setSaving( false );
        }
    };

    return (
        <form
            className={styles.form}
            onSubmit={( event ) => void onSubmit( event )}
            noValidate
            aria-label={editing ? 'Edit session' : 'Log a study session'}
        >
            {formError && <p className={form.formError} role="alert">{formError}</p>}

            {props.session
                ? <p className={styles.about}>{props.about}</p>
                : <StudyChoice options={options} values={values} errors={fieldErrors} set={set} field={field} />}

            <div className={styles.row}>
                <FormField field="date" label="Date" error={fieldErrors.date}>
                    <input
                        {...field( 'date' )}
                        type="date"
                        max={toDateInput( new Date() )}
                        value={values.date}
                        onChange={( event ) => set( { date: event.target.value } )}
                    />
                </FormField>
                <FormField field="time" label="Start time" error={fieldErrors.time}>
                    <input {...field( 'time' )} type="time" value={values.time} onChange={( event ) => set( { time: event.target.value } )} />
                </FormField>
                <FormField field="duration" label="Minutes" error={fieldErrors.duration}>
                    <input
                        {...field( 'duration' )}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_DURATION_MINUTES}
                        step={1}
                        value={values.duration}
                        onChange={( event ) => set( { duration: event.target.value } )}
                    />
                </FormField>
            </div>

            <FormField field="notes" label="Notes (optional)" error={fieldErrors.notes}>
                <textarea
                    {...field( 'notes' )}
                    rows={3}
                    value={values.notes}
                    placeholder="What went well, what to revisit…"
                    onChange={( event ) => set( { notes: event.target.value } )}
                />
            </FormField>

            <div className={styles.actions}>
                {canSave && (
                    <button type="submit" className={`${shared.button} ${shared.primary}`} disabled={saving}>
                        {editing ? 'Save changes' : 'Log session'}
                    </button>
                )}
                <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={props.onCancel}>
                    Cancel
                </button>
            </div>
        </form>
    );
}

interface StudyChoiceProps {
    options: StudyOptions;
    values: SessionFormValues;
    errors: FieldErrors<Field>;
    set: ( changes: Partial<SessionFormValues> ) => void;
    field: ( name: Field ) => ReturnType<typeof fieldProps>;
}

/** What was studied: a learning path, then a topic in it (grouped by module), then optionally one of its items. */
function StudyChoice( { options: { paths, tree }, values, errors, set, field }: StudyChoiceProps ) {
    if ( paths.status === 'loading' ) {
        return <p className={styles.note} role="status">Loading your learning paths…</p>;
    }
    if ( paths.status === 'error' ) {
        return <p className={form.formError} role="alert">Couldn&apos;t load your learning paths. Close this form and try again.</p>;
    }
    if ( paths.value.length === 0 ) {
        return (
            <p className={styles.note}>
                You aren&apos;t following any learning paths yet. Enroll in one to log study time against its topics.
            </p>
        );
    }

    const modules = tree?.status === 'ready' ? tree.value.modules : [];
    const topic = modules.flatMap( ( module ) => module.topics ).find( ( candidate ) => candidate.id === values.topic );

    return (
        <div className={styles.row}>
            <FormField field="path" label="Learning path" error={errors.path}>
                <select {...field( 'path' )} value={values.path} onChange={( event ) => set( { path: event.target.value, topic: '', item: '' } )}>
                    <option value="">Choose a path</option>
                    {paths.value.map( ( enrollment ) => (
                        <option key={enrollment.id} value={enrollment.id}>{enrollment.learningPath.title}</option>
                    ) )}
                </select>
            </FormField>
            <FormField field="topic" label="Topic" error={errors.topic ?? ( tree?.status === 'error' ? 'Couldn\'t load this path. Choose it again.' : undefined )}>
                <select
                    {...field( 'topic' )}
                    value={values.topic}
                    disabled={tree?.status !== 'ready'}
                    onChange={( event ) => set( { topic: event.target.value, item: '' } )}
                >
                    <option value="">{tree?.status === 'loading' ? 'Loading topics…' : 'Choose a topic'}</option>
                    {modules.map( ( module ) => (
                        <optgroup key={module.id} label={module.title}>
                            {module.topics.map( ( option ) => (
                                <option key={option.id} value={option.id}>{option.title}</option>
                            ) )}
                        </optgroup>
                    ) )}
                </select>
            </FormField>
            <FormField field="item" label="Item (optional)" error={errors.item}>
                <select {...field( 'item' )} value={values.item} disabled={!topic} onChange={( event ) => set( { item: event.target.value } )}>
                    <option value="">Whole topic</option>
                    {topic?.items.map( ( item ) => (
                        <option key={item.id} value={item.id}>{item.isOptional ? `${item.title} (optional)` : item.title}</option>
                    ) )}
                </select>
            </FormField>
        </div>
    );
}
