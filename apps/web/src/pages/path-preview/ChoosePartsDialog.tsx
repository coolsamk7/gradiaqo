import { useEffect, useRef, useState } from 'react';

import { Dialog } from '../../components/Dialog.tsx';
import form from '../../forms/form.module.css';
import shared from '../../styles/shared.module.css';
import type { PathModules } from './parts.ts';
import { allTopics, countItems, moduleState, toggleModule, toggleTopic } from './parts.ts';
import styles from './PathPreview.module.css';

interface ChoosePartsDialogProps {
    modules: PathModules;
    /** The topics ticked when it opens. */
    initial: Set<string>;
    /** The main button: "Enroll" before following the path, "Save" after. */
    confirm: string;
    /** Saves the choice; resolves with an error message if that failed (the dialog stays open). */
    onConfirm: ( ticked: Set<string> ) => Promise<string | undefined>;
    onClose: () => void;
}

/** Ticks the modules and topics to follow (Figma: M1 › Enroll · choose parts). */
export function ChoosePartsDialog( { modules, initial, confirm, onConfirm, onClose }: ChoosePartsDialogProps ) {
    const [ ticked, setTicked ] = useState( initial );
    const [ error, setError ] = useState<string>();
    const [ saving, setSaving ] = useState( false );
    const shown = modules.filter( ( module ) => module.topics.length > 0 );
    const total = countItems( modules, allTopics( modules ) );

    const save = async () => {
        if ( ticked.size === 0 ) {
            setError( 'Choose at least one topic.' );

            return;
        }

        setSaving( true );
        setError( undefined );
        const failed = await onConfirm( ticked );

        if ( failed ) {
            setError( failed );
            setSaving( false );
        }
    };

    return (
        <Dialog
            title="Choose what to follow"
            description="Pick modules and topics. Anything the author adds later inside what you picked is included too."
            onClose={onClose}
            wide
        >
            {error && <p className={`${form.formError} ${styles.flush}`} role="alert">{error}</p>}
            <ul className={styles.selection} aria-label="Modules and topics">
                {shown.map( ( module ) => (
                    <li key={module.id}>
                        <label className={styles.moduleChoice}>
                            <Checkbox
                                state={moduleState( module, ticked )}
                                onChange={() => setTicked( ( current ) => toggleModule( module, current ) )}
                            />
                            {module.title}
                        </label>
                        <ul className={styles.topicChoices}>
                            {module.topics.map( ( topic ) => (
                                <li key={topic.id}>
                                    <label className={styles.topicChoice}>
                                        <input
                                            type="checkbox"
                                            checked={ticked.has( topic.id )}
                                            onChange={() => setTicked( ( now ) => toggleTopic( topic.id, now ) )}
                                        />
                                        <span className={styles.choiceName}>{topic.title}</span>
                                        <span className={styles.choiceCount}>{items( topic.items.length )}</span>
                                    </label>
                                </li>
                            ) )}
                        </ul>
                    </li>
                ) )}
            </ul>
            <div className={styles.dialogFooter}>
                <p className={styles.selected} aria-live="polite">{`${countItems( modules, ticked )} of ${items( total )} selected`}</p>
                <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={onClose}>Cancel</button>
                <button type="button" className={`${shared.button} ${shared.accent}`} disabled={saving} onClick={() => void save()}>
                    {saving ? 'Saving…' : confirm}
                </button>
            </div>
        </Dialog>
    );
}

/** A checkbox that also shows "some" (the indeterminate state), for a module with some topics ticked. */
function Checkbox( { state, onChange }: { state: 'all' | 'some' | 'none'; onChange: () => void } ) {
    const ref = useRef<HTMLInputElement>( null );

    useEffect( () => {
        ref.current!.indeterminate = state === 'some';
    }, [ state ] );

    return <input ref={ref} type="checkbox" checked={state === 'all'} aria-checked={state === 'some' ? 'mixed' : undefined} onChange={onChange} />;
}

function items( count: number ): string {
    return count === 1 ? '1 item' : `${count} items`;
}
