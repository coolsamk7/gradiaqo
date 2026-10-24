import { useState } from 'react';

import { Icon } from '../../components/Icon.tsx';
import { Menu } from '../../components/Menu.tsx';
import { StatusBadge } from '../../components/StatusBadge.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Builder.module.css';
import type { ItemNode, TopicNode } from './builder-tree.ts';
import { itemMeta, moved, TYPE_ICONS } from './builder-tree.ts';
import { LinkItemsDialog } from './LinkItemsDialog.tsx';
import { NewItemForm } from './NewItemForm.tsx';
import { saveErrorMessage } from './problems.ts';
import type { Send } from './use-path-builder.ts';

/** The items of the chosen topic: mark them optional, move or remove them, and add new or catalog ones. */
export function TopicItems( { topic, send }: { topic: TopicNode; send: Send } ) {
    const [ adding, setAdding ] = useState( false );
    const [ linking, setLinking ] = useState( false );
    const [ error, setError ] = useState<string>();
    const ids = topic.items.map( ( item ) => item.id );

    const change = async ( url: string, method: 'PUT' | 'DELETE', body?: unknown ) => {
        setError( undefined );
        try {
            await send( `/topics/${topic.id}${url}`, { method, body } );
        } catch ( caught ) {
            setError( saveErrorMessage( caught ) );
        }
    };

    return (
        <>
            <section className={app.card} aria-labelledby="items-title">
                <div className={styles.cardHead}>
                    <h2 id="items-title" className={styles.cardTitle}>{`Items · ${topic.items.length}`}</h2>
                    <div className={styles.cardActions}>
                        <button type="button" className={`${shared.button} ${shared.secondary} ${shared.small}`} onClick={() => setLinking( true )}>
                            <Icon name="search" />
                            Link from catalog
                        </button>
                        <button type="button" className={`${shared.button} ${shared.primary} ${shared.small}`} onClick={() => setAdding( true )}>
                            <Icon name="plus" />
                            New item
                        </button>
                    </div>
                </div>
                <p className={`${app.muted} ${app.small}`}>
                    Catalog items are linked, not copied: progress on them counts in every path.
                </p>
                {error && <p className={styles.error} role="alert">{error}</p>}

                {topic.items.length === 0
                    ? (
                            <p className={styles.noItems}>
                                No items yet. Add your own, or link problems and articles from the catalog.
                            </p>
                        )
                    : (
                            <ul className={styles.items} aria-label={`Items in ${topic.title}`}>
                                {topic.items.map( ( item, index ) => (
                                    <ItemRow
                                        key={item.id}
                                        item={item}
                                        first={index === 0}
                                        last={index === topic.items.length - 1}
                                        onOptional={( isOptional ) => void change( `/items/${item.id}`, 'PUT', { isOptional } )}
                                        onMove={( by ) => void change( '/items/order', 'PUT', { ids: moved( ids, item.id, by ) } )}
                                        onRemove={() => void change( `/items/${item.id}`, 'DELETE' )}
                                    />
                                ) )}
                            </ul>
                        )}
            </section>

            {adding && <NewItemForm topic={topic} send={send} onClose={() => setAdding( false )} />}
            {linking && <LinkItemsDialog topic={topic} send={send} onClose={() => setLinking( false )} />}
        </>
    );
}

interface ItemRowProps {
    item: ItemNode;
    first: boolean;
    last: boolean;
    onOptional: ( isOptional: boolean ) => void;
    onMove: ( by: -1 | 1 ) => void;
    onRemove: () => void;
}

function ItemRow( { item, first, last, onOptional, onMove, onRemove }: ItemRowProps ) {
    return (
        <li className={styles.item}>
            <span className={styles.itemIcon}><Icon name={TYPE_ICONS[item.type]} /></span>
            <div className={styles.itemMain}>
                <span className={styles.itemTitle}>
                    {item.title}
                    <StatusBadge status={item.status} unlessPublished />
                </span>
                <span className={`${app.muted} ${app.small}`}>{itemMeta( item )}</span>
            </div>
            <label className={styles.switch}>
                <input
                    type="checkbox"
                    role="switch"
                    aria-label={`${item.title} is optional`}
                    checked={item.isOptional}
                    onChange={( event ) => onOptional( event.target.checked )}
                />
                <span aria-hidden="true">Optional</span>
            </label>
            <Menu
                label={`More for ${item.title}`}
                actions={[
                    { label: 'Move up', hidden: first, onSelect: () => onMove( -1 ) },
                    { label: 'Move down', hidden: last, onSelect: () => onMove( 1 ) },
                    { label: 'Remove from topic', danger: true, onSelect: onRemove },
                ]}
            />
        </li>
    );
}
