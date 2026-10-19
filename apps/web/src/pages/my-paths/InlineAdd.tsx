import type { FormEvent } from 'react';
import { useState } from 'react';

import { Icon } from '../../components/Icon.tsx';
import shared from '../../styles/shared.module.css';
import styles from './Builder.module.css';
import { saveErrorMessage } from './problems.ts';

interface InlineAddProps {
    /** What is added: "Module", "Topic". */
    noun: string;
    /** Names the button and the field for screen readers: "Add a topic to Patterns". */
    label: string;
    /** Rejects when it wasn't saved. */
    onAdd: ( title: string ) => Promise<unknown>;
    className?: string;
}

/** A "+ Topic" button that turns into a title field with Add and Cancel. */
export function InlineAdd( { noun, label, onAdd, className = '' }: InlineAddProps ) {
    const [ open, setOpen ] = useState( false );
    const [ title, setTitle ] = useState( '' );
    const [ error, setError ] = useState<string>();
    const [ saving, setSaving ] = useState( false );

    const close = () => {
        setOpen( false );
        setTitle( '' );
        setError( undefined );
    };

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        if ( !title.trim() ) {
            setError( 'Enter a title.' );

            return;
        }

        setSaving( true );
        try {
            await onAdd( title.trim() );
            close();
        } catch ( caught ) {
            setError( saveErrorMessage( caught, `There's already a ${noun.toLowerCase()} with this title here.` ) );
        }
        setSaving( false );
    };

    if ( !open ) {
        return (
            <button type="button" className={`${styles.add} ${className}`} aria-label={label} onClick={() => setOpen( true )}>
                <Icon name="plus" />
                {noun}
            </button>
        );
    }

    return (
        <form className={`${styles.inlineForm} ${className}`} onSubmit={( event ) => void onSubmit( event )} noValidate>
            <input
                className={styles.inlineInput}
                aria-label={`${noun} title`}
                aria-invalid={error ? true : undefined}
                placeholder={`${noun} title`}
                maxLength={200}
                autoFocus
                value={title}
                onChange={( event ) => setTitle( event.target.value )}
                onKeyDown={( event ) => event.key === 'Escape' && close()}
            />
            <button type="submit" className={`${shared.button} ${shared.primary} ${shared.small}`} disabled={saving}>Add</button>
            <button type="button" className={`${shared.button} ${shared.ghost} ${shared.small}`} onClick={close}>Cancel</button>
            {error && <p className={styles.inlineError} role="alert">{error}</p>}
        </form>
    );
}
