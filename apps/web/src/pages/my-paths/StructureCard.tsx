import type { LearningPathTreeJson } from '@studylog/schemas';
import { useState } from 'react';

import { Icon } from '../../components/Icon.tsx';
import { Menu } from '../../components/Menu.tsx';
import app from '../../styles/app.module.css';
import styles from './Builder.module.css';
import type { ModuleNode, Selected, Selection } from './builder-tree.ts';
import { moved } from './builder-tree.ts';
import { InlineAdd } from './InlineAdd.tsx';
import { saveErrorMessage } from './problems.ts';
import type { Send } from './use-path-builder.ts';

interface StructureCardProps {
    path: LearningPathTreeJson;
    selected: Selected;
    onSelect: ( selection: Selection ) => void;
    send: Send;
}

/** The path's modules and their topics: pick one to edit, add more, or move them up and down. */
export function StructureCard( { path, selected, onSelect, send }: StructureCardProps ) {
    const [ error, setError ] = useState<string>();
    const moduleIds = path.modules.map( ( module ) => module.id );

    const move = async ( url: string, ids: string[] ) => {
        setError( undefined );
        try {
            await send( url, { method: 'PUT', body: { ids } } );
        } catch ( caught ) {
            setError( saveErrorMessage( caught ) );
        }
    };

    const addModule = async ( title: string ) => {
        const module = await send<{ id: string }>( `/paths/${path.id}/modules`, { method: 'POST', body: { title } } );

        onSelect( { kind: 'module', id: module.id } );
    };

    return (
        <section className={`${app.card} ${styles.structure}`} aria-labelledby="structure-title">
            <div className={styles.cardHead}>
                <h2 id="structure-title" className={styles.cardTitle}>Structure</h2>
                <InlineAdd noun="Module" label="Add a module" onAdd={addModule} />
            </div>
            {error && <p className={styles.inlineError} role="alert">{error}</p>}

            {path.modules.length === 0 && (
                <p className={`${app.muted} ${app.small}`}>No modules yet. Add one, then add topics to it.</p>
            )}

            <ul className={styles.tree} aria-label="Modules">
                {path.modules.map( ( module, index ) => (
                    <ModuleBranch
                        key={module.id}
                        module={module}
                        selected={selected}
                        onSelect={onSelect}
                        send={send}
                        first={index === 0}
                        last={index === path.modules.length - 1}
                        onMove={( by ) => void move( `/paths/${path.id}/modules/order`, moved( moduleIds, module.id, by ) )}
                        onMoveTopic={( id, by ) => void move(
                            `/modules/${module.id}/topics/order`,
                            moved( module.topics.map( ( topic ) => topic.id ), id, by ),
                        )}
                    />
                ) )}
            </ul>
        </section>
    );
}

interface ModuleBranchProps {
    module: ModuleNode;
    selected: Selected;
    onSelect: ( selection: Selection ) => void;
    send: Send;
    first: boolean;
    last: boolean;
    onMove: ( by: -1 | 1 ) => void;
    onMoveTopic: ( topicId: string, by: -1 | 1 ) => void;
}

function ModuleBranch( { module, selected, onSelect, send, first, last, onMove, onMoveTopic }: ModuleBranchProps ) {
    const [ open, setOpen ] = useState( true );
    const isSelected = selected.kind === 'module' && selected.module.id === module.id;

    const addTopic = async ( title: string ) => {
        const topic = await send<{ id: string }>( `/modules/${module.id}/topics`, { method: 'POST', body: { title } } );

        onSelect( { kind: 'topic', id: topic.id } );
    };

    return (
        <li className={styles.branch}>
            <div className={`${styles.node} ${styles.moduleNode} ${isSelected ? styles.selected : ''}`}>
                <button
                    type="button"
                    className={styles.toggle}
                    aria-label={`${open ? 'Collapse' : 'Expand'} ${module.title}`}
                    aria-expanded={open}
                    onClick={() => setOpen( !open )}
                >
                    <Icon name={open ? 'chevron-down' : 'chevron-right'} />
                </button>
                <button
                    type="button"
                    className={styles.nodeButton}
                    aria-current={isSelected ? 'true' : undefined}
                    onClick={() => onSelect( { kind: 'module', id: module.id } )}
                >
                    {module.title}
                </button>
                <Menu
                    label={`More for ${module.title}`}
                    actions={[
                        { label: 'Move up', hidden: first, onSelect: () => onMove( -1 ) },
                        { label: 'Move down', hidden: last, onSelect: () => onMove( 1 ) },
                        { label: 'Edit or delete', onSelect: () => onSelect( { kind: 'module', id: module.id } ) },
                    ]}
                />
            </div>

            {open && (
                <ul className={styles.topics} aria-label={`Topics in ${module.title}`}>
                    {module.topics.map( ( topic, index ) => {
                        const current = selected.kind === 'topic' && selected.topic.id === topic.id;

                        return (
                            <li key={topic.id} className={`${styles.node} ${styles.topicNode} ${current ? styles.selected : ''}`}>
                                <button
                                    type="button"
                                    className={styles.nodeButton}
                                    aria-current={current ? 'true' : undefined}
                                    aria-label={`${topic.title} (${topic.items.length} ${topic.items.length === 1 ? 'item' : 'items'})`}
                                    onClick={() => onSelect( { kind: 'topic', id: topic.id } )}
                                >
                                    <span>{topic.title}</span>
                                    <span className={styles.count}>{topic.items.length}</span>
                                </button>
                                <Menu
                                    label={`More for ${topic.title}`}
                                    actions={[
                                        { label: 'Move up', hidden: index === 0, onSelect: () => onMoveTopic( topic.id, -1 ) },
                                        { label: 'Move down', hidden: index === module.topics.length - 1, onSelect: () => onMoveTopic( topic.id, 1 ) },
                                        { label: 'Edit or delete', onSelect: () => onSelect( { kind: 'topic', id: topic.id } ) },
                                    ]}
                                />
                            </li>
                        );
                    } )}
                    <li>
                        <InlineAdd noun="Topic" label={`Add a topic to ${module.title}`} onAdd={addTopic} className={styles.addTopic} />
                    </li>
                </ul>
            )}
        </li>
    );
}
