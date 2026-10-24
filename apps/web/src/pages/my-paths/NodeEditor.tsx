import type { LearningPathTreeJson } from '@studylog/schemas';
import type { CatalogStatus } from '@studylog/schemas/enums';
import type { FormEvent } from 'react';
import { useState } from 'react';

import { STATUS_LABELS } from '../../format/catalog-status.ts';
import { fieldProps } from '../../forms/field-props.ts';
import { FormField } from '../../forms/FormField.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Builder.module.css';
import type { Selected } from './builder-tree.ts';
import { saveErrorMessage } from './problems.ts';
import type { Send } from './use-path-builder.ts';

interface NodeEditorProps {
    selected: Selected;
    path: LearningPathTreeJson;
    send: Send;
    /** In the global catalog: parts start as drafts, and their status is changed here (saved right away). */
    withStatus?: boolean;
}

/** What the editor needs to know about the chosen part: what to call it, where to save it, and what deleting does. */
function describe( selected: Selected, path: LearningPathTreeJson ) {
    switch ( selected.kind ) {
        case 'path':
            return { node: path, noun: 'Path', url: `/paths/${path.id}`, context: 'Its title and description', deletes: undefined };

        case 'module':
            return {
                node: selected.module,
                noun: 'Module',
                url: `/modules/${selected.module.id}`,
                context: `${selected.module.topics.length} ${selected.module.topics.length === 1 ? 'topic' : 'topics'}`,
                deletes: 'Delete this module? Its topics go too; their items stay in your catalog.',
            };

        default:
            return {
                node: selected.topic,
                noun: 'Topic',
                url: `/topics/${selected.topic.id}`,
                context: `In module ${selected.module.title}`,
                deletes: 'Delete this topic? Its items stay in your catalog.',
            };
    }
}

/** The title and description of the chosen path, module or topic; a module or topic can be deleted here too. */
export function NodeEditor( { selected, path, send, withStatus = false }: NodeEditorProps ) {
    const { node, noun, url, context, deletes } = describe( selected, path );
    const [ title, setTitle ] = useState( node.title );
    const [ description, setDescription ] = useState( node.description ?? '' );
    const [ titleError, setTitleError ] = useState<string>();
    const [ error, setError ] = useState<string>();
    const [ busy, setBusy ] = useState( false );
    const [ confirming, setConfirming ] = useState( false );
    const [ saved, setSaved ] = useState( false );
    const changed = title !== node.title || description !== ( node.description ?? '' );
    const field = noun.toLowerCase();

    const run = async ( change: () => Promise<unknown> ) => {
        setBusy( true );
        setError( undefined );
        try {
            await change();
        } catch ( caught ) {
            setError( saveErrorMessage( caught, `There's already a ${field} with this title here.` ) );
        }
        setBusy( false );
    };

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        if ( !title.trim() ) {
            setTitleError( 'Enter a title.' );

            return;
        }

        setTitleError( undefined );
        await run( async () => {
            await send( url, { method: 'PATCH', body: { title: title.trim(), description: description.trim() || null } } );
            // Show what was saved.
            setTitle( title.trim() );
            setDescription( description.trim() );
            setSaved( true );
        } );
    };

    return (
        <section className={app.card} aria-labelledby="editor-title">
            <form className={styles.editor} onSubmit={( event ) => void onSubmit( event )} noValidate>
                <div className={styles.titles}>
                    <h2 id="editor-title" className={styles.cardTitle}>{`${noun} · ${node.title}`}</h2>
                    <p className={`${app.muted} ${app.small}`}>{context}</p>
                </div>
                {error && <p className={styles.error} role="alert">{error}</p>}
                <FormField field={`${field}-title`} label="Title" error={titleError}>
                    <input
                        {...fieldProps( `${field}-title`, titleError )}
                        maxLength={200}
                        value={title}
                        onChange={( event ) => {
                            setTitle( event.target.value );
                            setSaved( false );
                        }}
                    />
                </FormField>
                <FormField field={`${field}-description`} label="Description (optional)">
                    <textarea
                        {...fieldProps( `${field}-description`, undefined )}
                        rows={3}
                        value={description}
                        onChange={( event ) => {
                            setDescription( event.target.value );
                            setSaved( false );
                        }}
                    />
                </FormField>

                {withStatus && (
                    <FormField field={`${field}-status`} label="Status" hint="Learners only see published parts.">
                        <select
                            {...fieldProps( `${field}-status`, undefined, 'yes' )}
                            value={node.status}
                            disabled={busy}
                            onChange={( event ) => void run( () => send( url, {
                                method: 'PATCH',
                                body: { status: event.target.value as CatalogStatus },
                            } ) )}
                        >
                            {Object.entries( STATUS_LABELS ).map( ( [ value, label ] ) => (
                                <option key={value} value={value}>{label}</option>
                            ) )}
                        </select>
                    </FormField>
                )}

                <div className={styles.editorActions}>
                    {confirming && deletes
                        ? (
                                <div className={styles.confirm} role="group" aria-label={`Delete this ${field}?`}>
                                    <span>{deletes}</span>
                                    <button
                                        type="button"
                                        className={`${shared.button} ${shared.danger} ${shared.small}`}
                                        disabled={busy}
                                        onClick={() => void run( () => send( url, { method: 'DELETE' } ) )}
                                    >
                                        Delete
                                    </button>
                                    <button type="button" className={`${shared.button} ${shared.secondary} ${shared.small}`} onClick={() => setConfirming( false )}>
                                        Cancel
                                    </button>
                                </div>
                            )
                        : (
                                <>
                                    <button type="submit" className={`${shared.button} ${shared.primary} ${shared.small}`} disabled={!changed || busy}>
                                        Save changes
                                    </button>
                                    {saved && <span className={`${app.muted} ${app.small}`} role="status">Saved</span>}
                                    {deletes && (
                                        <button type="button" className={`${shared.button} ${shared.ghost} ${shared.small} ${styles.deleteNode}`} onClick={() => setConfirming( true )}>
                                            {`Delete ${field}`}
                                        </button>
                                    )}
                                </>
                            )}
                </div>
            </form>
        </section>
    );
}
