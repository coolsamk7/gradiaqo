import type { EnrollmentJson, InterviewGoalJson } from '@studylog/schemas';
import type { FormEvent } from 'react';
import { useState } from 'react';

import { ApiError, NetworkError } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';
import { Dialog } from '../../components/Dialog.tsx';
import { toDateInput } from '../../format/format.ts';
import { fieldProps } from '../../forms/field-props.ts';
import form from '../../forms/form.module.css';
import { FormField } from '../../forms/FormField.tsx';
import shared from '../../styles/shared.module.css';
import type { GoalErrors } from './goal-form.ts';
import { firstInvalid, validateGoal } from './goal-form.ts';
import styles from './Readiness.module.css';

interface GoalDialogProps {
    /** The current goal, to edit; null to set a first one. */
    goal: InterviewGoalJson | null;
    /** Paths the user follows, to choose from. */
    paths: EnrollmentJson[];
    onClose: () => void;
    onSaved: () => void;
}

/** Sets or changes the interview goal (Figma: Insights › Interview ready · set a goal): a name, a date and the paths. */
export function GoalDialog( { goal, paths, onClose, onSaved }: GoalDialogProps ) {
    const { request } = useAuth();
    const today = toDateInput( new Date() );
    const [ title, setTitle ] = useState( goal?.title ?? '' );
    const [ date, setDate ] = useState( goal?.targetDate ?? '' );
    // Paths dropped since the goal was set aren't offered, so they fall out when it's saved.
    const [ chosen, setChosen ] = useState( () => new Set(
        goal?.enrollmentIds.filter( ( id ) => paths.some( ( path ) => path.id === id ) ),
    ) );
    const [ errors, setErrors ] = useState<GoalErrors>( {} );
    const [ formError, setFormError ] = useState<string>();
    const [ saving, setSaving ] = useState( false );
    const chosenPaths = paths.filter( ( path ) => chosen.has( path.id ) );
    const items = chosenPaths.reduce( ( sum, path ) => sum + path.progress.total, 0 );

    const toggle = ( id: string ) => setChosen( ( current ) => {
        const next = new Set( current );

        if ( !next.delete( id ) ) {
            next.add( id );
        }

        return next;
    } );

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        const found = validateGoal( title, date, chosen.size, today );
        const invalid = firstInvalid( found );

        setErrors( found );
        if ( invalid ) {
            document.getElementById( invalid )?.focus();

            return;
        }

        setSaving( true );
        setFormError( undefined );
        try {
            await request( '/me/interview-goal', {
                method: 'PUT',
                body: { title: title.trim(), targetDate: date, enrollmentIds: chosenPaths.map( ( path ) => path.id ) },
            } );
            onSaved();
        } catch ( error ) {
            setFormError( saveError( error ) );
            setSaving( false );
        }
    };

    return (
        <Dialog title="Your interview goal" description="You can change it any time." onClose={onClose}>
            <form className={styles.goalForm} onSubmit={( event ) => void onSubmit( event )} noValidate>
                {formError && <p className={`${form.formError} ${styles.goalError}`} role="alert">{formError}</p>}
                <div className={styles.goalFields}>
                    <FormField field="goal-title" label="What are you preparing for?" error={errors.title}>
                        <input
                            {...fieldProps( 'goal-title', errors.title )}
                            maxLength={100}
                            placeholder="SDE interview"
                            autoFocus
                            value={title}
                            onChange={( event ) => setTitle( event.target.value )}
                        />
                    </FormField>
                    <FormField field="goal-date" label="Date" error={errors.date}>
                        <input
                            {...fieldProps( 'goal-date', errors.date )}
                            type="date"
                            min={today}
                            value={date}
                            onChange={( event ) => setDate( event.target.value )}
                        />
                    </FormField>
                </div>
                <fieldset className={styles.goalPaths} aria-describedby={errors.paths ? 'goal-paths-error' : undefined}>
                    <legend className={form.label}>Paths that count</legend>
                    <ul id="goal-paths" tabIndex={-1} className={styles.pathList}>
                        {paths.map( ( path ) => (
                            <li key={path.id}>
                                <label className={styles.pathChoice}>
                                    <input type="checkbox" checked={chosen.has( path.id )} onChange={() => toggle( path.id )} />
                                    <span className={styles.pathName}>{path.learningPath.title}</span>
                                    <span className={styles.pathItems}>{countItems( path.progress.total )}</span>
                                </label>
                            </li>
                        ) )}
                    </ul>
                    {errors.paths && <p id="goal-paths-error" className={form.fieldError}>{errors.paths}</p>}
                </fieldset>
                <div className={styles.goalFooter}>
                    <p className={styles.goalTotal}>{chosen.size > 0 ? countItems( items ) : 'No paths chosen'}</p>
                    <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={onClose}>Cancel</button>
                    <button type="submit" className={`${shared.button} ${shared.primary}`} disabled={saving}>
                        {saving ? 'Saving…' : 'Save goal'}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}

function countItems( count: number ): string {
    return count === 1 ? '1 item' : `${count} items`;
}

function saveError( error: unknown ): string {
    if ( error instanceof NetworkError ) {
        return 'Can\'t reach Gradiaqo right now. Check your connection and try again.';
    }

    return error instanceof ApiError && error.status === 400
        ? 'Check the date and paths: the date can\'t be in the past, and the paths must be ones you follow.'
        : 'Something went wrong, so the goal wasn\'t saved. Please try again.';
}
