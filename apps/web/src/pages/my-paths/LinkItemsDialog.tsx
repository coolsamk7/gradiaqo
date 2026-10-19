import type { ItemPageJson } from '@studylog/schemas';
import { useEffect, useState } from 'react';

import { useAuth } from '../../auth/auth-context.ts';
import dialog from '../../components/Dialog.module.css';
import { Dialog } from '../../components/Dialog.tsx';
import { Icon } from '../../components/Icon.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Builder.module.css';
import type { TopicNode } from './builder-tree.ts';
import { itemMeta, TYPE_ICONS } from './builder-tree.ts';
import { loadErrorMessage, saveErrorMessage } from './problems.ts';
import type { Send } from './use-path-builder.ts';

const SEARCH_DELAY_MS = 300;

type Results =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; page: ItemPageJson };

/** Searches the official catalog and links items into the topic (Figma: Path builder · link from catalog). */
export function LinkItemsDialog( { topic, send, onClose }: { topic: TopicNode; send: Send; onClose: () => void } ) {
    const { request } = useAuth();
    const [ typed, setTyped ] = useState( '' );
    const [ search, setSearch ] = useState( '' );
    const [ answer, setAnswer ] = useState<{ search: string; results: Results }>();
    const [ linking, setLinking ] = useState<string>();
    const [ linked, setLinked ] = useState( 0 );
    const [ error, setError ] = useState<string>();
    const inTopic = new Set( topic.items.map( ( item ) => item.id ) );
    const results: Results = answer?.search === search ? answer.results : { status: 'loading' };

    useEffect( () => {
        const timer = setTimeout( () => setSearch( typed.trim() ), SEARCH_DELAY_MS );

        return () => clearTimeout( timer );
    }, [ typed ] );

    useEffect( () => {
        let current = true;
        const query = new URLSearchParams( { limit: '20', ...( search ? { search } : {} ) } );

        request<ItemPageJson>( `/catalog/items?${query.toString()}` ).then(
            ( page ) => current && setAnswer( { search, results: { status: 'ready', page } } ),
            ( caught: unknown ) => current && setAnswer( { search, results: { status: 'error', message: loadErrorMessage( caught ) } } ),
        );

        return () => {
            current = false;
        };
    }, [ request, search ] );

    const link = async ( itemId: string ) => {
        setLinking( itemId );
        setError( undefined );
        try {
            await send( `/topics/${topic.id}/items/${itemId}`, { method: 'PUT', body: {} } );
            setLinked( ( n ) => n + 1 );
        } catch ( caught ) {
            setError( saveErrorMessage( caught ) );
        }
        setLinking( undefined );
    };

    return (
        <Dialog
            title="Link items from the catalog"
            description="Linked items aren't copied: progress on them counts in every path that uses them."
            onClose={onClose}
            wide
        >
            <label className={styles.search}>
                <Icon name="search" />
                <span className="visually-hidden">Search the catalog</span>
                <input autoFocus type="search" placeholder="Search problems, articles, videos…" value={typed} onChange={( event ) => setTyped( event.target.value )} />
            </label>
            {error && <p className={styles.error} role="alert">{error}</p>}

            {results.status === 'loading' && (
                <div className={app.status} role="status">
                    <span className={app.spinner} aria-hidden="true" />
                    Searching…
                </div>
            )}
            {results.status === 'error' && <p className={styles.error} role="alert">{results.message}</p>}
            {results.status === 'ready' && results.page.items.length === 0 && (
                <p className={app.muted}>{search ? `Nothing in the catalog matches “${search}”.` : 'The catalog is empty.'}</p>
            )}
            {results.status === 'ready' && results.page.items.length > 0 && (
                <ul className={styles.results} aria-label="Catalog items">
                    {results.page.items.map( ( item ) => (
                        <li key={item.id} className={styles.result}>
                            <span className={styles.itemIcon}><Icon name={TYPE_ICONS[item.type]} /></span>
                            <div className={styles.itemMain}>
                                <span className={styles.itemTitle}>{item.title}</span>
                                <span className={`${app.muted} ${app.small}`}>{itemMeta( item, '' )}</span>
                            </div>
                            {inTopic.has( item.id )
                                ? <span className={`${app.badge} ${app.badgeSuccess}`}>Linked</span>
                                : (
                                        <button
                                            type="button"
                                            className={`${shared.button} ${shared.secondary} ${shared.small}`}
                                            aria-label={`Link ${item.title}`}
                                            disabled={linking !== undefined}
                                            onClick={() => void link( item.id )}
                                        >
                                            Link
                                        </button>
                                    )}
                        </li>
                    ) )}
                </ul>
            )}

            <div className={`${dialog.actions} ${styles.linkFooter}`}>
                <span className={`${app.muted} ${app.small}`} role="status">{`${linked} linked to ${topic.title}`}</span>
                <button type="button" className={`${shared.button} ${shared.primary}`} onClick={onClose}>Done</button>
            </div>
        </Dialog>
    );
}
