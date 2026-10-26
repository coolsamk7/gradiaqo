import type { ManagedItemJson, ManagedItemPageJson, ManagedLearningPathJson, ReportPageJson } from '@studylog/schemas';
import { CatalogStatus, ItemType } from '@studylog/schemas/enums';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useLoaded } from '../../api/use-loaded.ts';
import { useAuth } from '../../auth/auth-context.ts';
import { AppLayout } from '../../components/AppLayout.tsx';
import { Icon } from '../../components/Icon.tsx';
import { CardSkeleton, LoadError, Loading } from '../../components/LoadStates.tsx';
import { Menu } from '../../components/Menu.tsx';
import { StatusBadge } from '../../components/StatusBadge.tsx';
import { STATUS_LABELS } from '../../format/catalog-status.ts';
import form from '../../forms/form.module.css';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import { TYPE_LABELS } from '../path/item-details.ts';
import styles from './Admin.module.css';
import { changeError, formatUpdated, loadError, statusActions } from './catalog.ts';
import { ItemDialog, NewPathDialog } from './CatalogDialogs.tsx';

/** How long to wait after typing in the items search before asking the API. */
const SEARCH_DELAY_MS = 300;

/**
 * The global catalog (Figma: M4 › Admin · Catalog, States › Admin · Items), for superadmins: official paths and
 * items (`?tab=items`), with their status. New content starts as a draft; only drafts can be deleted.
 */
export function CatalogPage() {
    const [ params, setParams ] = useSearchParams();
    const tab = params.get( 'tab' ) === 'items' ? 'items' : 'paths';
    const reports = useLoaded<ReportPageJson>( '/admin/reports?limit=1', loadError );
    const [ creating, setCreating ] = useState( false );

    return (
        <AppLayout>
            <div className={app.header}>
                <div className={app.titleBlock}>
                    <div className={styles.titleRow}>
                        <h1 className={app.title}>Global catalog</h1>
                        <span className={`${app.badge} ${app.badgeInverse}`}>Admin</span>
                    </div>
                    <p className={app.muted}>
                        Official paths and items everyone can see. New content starts as a draft; only drafts can be
                        deleted.
                    </p>
                </div>
                <button type="button" className={`${shared.button} ${shared.primary}`} onClick={() => setCreating( true )}>
                    <Icon name="plus" />
                    {tab === 'paths' ? 'New path' : 'New item'}
                </button>
            </div>

            <nav className={styles.tabs} aria-label="Admin">
                <button
                    type="button"
                    className={styles.tab}
                    aria-selected={tab === 'paths'}
                    onClick={() => setParams( {}, { replace: true } )}
                >
                    Paths
                </button>
                <button
                    type="button"
                    className={styles.tab}
                    aria-selected={tab === 'items'}
                    onClick={() => setParams( { tab: 'items' }, { replace: true } )}
                >
                    Items
                </button>
                <Link to="/app/admin/reports" className={styles.tab}>
                    {reports.state.status === 'ready' ? `Reports · ${reports.state.value.total}` : 'Reports'}
                </Link>
                <Link to="/app/admin/users" className={styles.tab}>Users</Link>
            </nav>

            {tab === 'paths' ? <PathsTab /> : <ItemsTab creating={creating} onCreated={() => setCreating( false )} />}
            {tab === 'paths' && creating && <NewPathDialog onClose={() => setCreating( false )} />}
        </AppLayout>
    );
}

function PathsTab() {
    const { request } = useAuth();
    const paths = useLoaded<ManagedLearningPathJson[]>( '/admin/catalog/paths', loadError );
    const [ search, setSearch ] = useState( '' );
    const [ status, setStatus ] = useState<CatalogStatus | ''>( '' );
    const [ error, setError ] = useState<string>();
    const now = new Date();

    const change = async ( send: () => Promise<unknown> ) => {
        setError( undefined );
        try {
            await send();
            paths.reload();
        } catch ( failure ) {
            setError( changeError( failure ) );
        }
    };

    if ( paths.state.status === 'loading' ) {
        return <Loading text="Loading the paths…"><CardSkeleton lines={4} /></Loading>;
    }
    if ( paths.state.status === 'error' ) {
        return <LoadError message={paths.state.message} retry={paths.reload} />;
    }

    const words = search.trim().toLowerCase();
    const shown = paths.state.value.filter( ( path ) =>
        path.title.toLowerCase().includes( words ) && ( !status || path.status === status ) );

    return (
        <>
            <div className={styles.toolbar}>
                <label className={styles.search}>
                    <Icon name="search" />
                    <span className="visually-hidden">Search paths</span>
                    <input type="search" placeholder="Search paths" value={search} onChange={( event ) => setSearch( event.target.value )} />
                </label>
                <StatusFilter value={status} onChange={setStatus} />
            </div>
            {error && <p className={app.error} role="alert">{error}</p>}
            <section className={`${app.card} ${styles.tableCard}`} aria-label="Paths">
                {shown.length === 0
                    ? <p className={app.empty}>{paths.state.value.length === 0 ? 'No official paths yet.' : 'No paths match.'}</p>
                    : (
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th scope="col">Path</th>
                                        <th scope="col">Status</th>
                                        <th scope="col">Modules</th>
                                        <th scope="col">Items</th>
                                        <th scope="col">Updated</th>
                                        <th scope="col"><span className="visually-hidden">Actions</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shown.map( ( path ) => (
                                        <tr key={path.id}>
                                            <th scope="row">{path.title}</th>
                                            <td><StatusBadge status={path.status} /></td>
                                            <td>{path.moduleCount}</td>
                                            <td>{path.itemCount}</td>
                                            <td>{formatUpdated( path.updatedAt, now )}</td>
                                            <td>
                                                <div className={styles.rowActions}>
                                                    <Link
                                                        to={`/app/admin/catalog/paths/${path.id}`}
                                                        className={`${shared.button} ${shared.secondary} ${shared.small}`}
                                                        aria-label={`Edit ${path.title}`}
                                                    >
                                                        <Icon name="edit" />
                                                        Edit
                                                    </Link>
                                                    <Menu
                                                        label={`More for ${path.title}`}
                                                        actions={statusActions(
                                                            path.status,
                                                            ( to ) => void change( () => request( `/admin/catalog/paths/${path.id}`, { method: 'PATCH', body: { status: to } } ) ),
                                                            () => void change( () => request( `/admin/catalog/paths/${path.id}`, { method: 'DELETE' } ) ),
                                                        )}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ) )}
                                </tbody>
                            </table>
                        )}
            </section>
        </>
    );
}

function ItemsTab( { creating, onCreated }: { creating: boolean; onCreated: () => void } ) {
    const { request } = useAuth();
    const [ typed, setTyped ] = useState( '' );
    const [ search, setSearch ] = useState( '' );
    const [ type, setType ] = useState<ItemType | ''>( '' );
    const [ editing, setEditing ] = useState<ManagedItemJson>();
    const [ error, setError ] = useState<string>();
    const query = new URLSearchParams( { ...( search ? { search } : {} ), ...( type ? { type } : {} ) } ).toString();
    const items = useLoaded<ManagedItemPageJson>( `/admin/catalog/items${query ? `?${query}` : ''}`, loadError );
    const now = new Date();

    // One request for the whole word, not one per letter.
    useEffect( () => {
        const timer = setTimeout( () => setSearch( typed.trim() ), SEARCH_DELAY_MS );

        return () => clearTimeout( timer );
    }, [ typed ] );

    const change = async ( send: () => Promise<unknown> ) => {
        setError( undefined );
        try {
            await send();
            items.reload();
        } catch ( failure ) {
            setError( changeError( failure ) );
        }
    };

    return (
        <>
            <div className={styles.toolbar}>
                <label className={styles.search}>
                    <Icon name="search" />
                    <span className="visually-hidden">Search items</span>
                    <input type="search" placeholder="Search items" value={typed} onChange={( event ) => setTyped( event.target.value )} />
                </label>
                <label className={styles.filter}>
                    <span className="visually-hidden">Type</span>
                    <select className={form.input} value={type} onChange={( event ) => setType( event.target.value as ItemType | '' )}>
                        <option value="">All types</option>
                        {Object.values( ItemType ).map( ( value ) => (
                            <option key={value} value={value}>{TYPE_LABELS[value]}</option>
                        ) )}
                    </select>
                </label>
            </div>
            {error && <p className={app.error} role="alert">{error}</p>}
            {items.state.status === 'loading' && <Loading text="Loading the items…"><CardSkeleton lines={4} /></Loading>}
            {items.state.status === 'error' && <LoadError message={items.state.message} retry={items.reload} />}
            {items.state.status === 'ready' && (
                <section className={`${app.card} ${styles.tableCard}`} aria-label="Items">
                    {items.state.value.items.length === 0
                        ? <p className={app.empty}>{query ? 'No items match.' : 'No official items yet.'}</p>
                        : (
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th scope="col">Item</th>
                                            <th scope="col">Type</th>
                                            <th scope="col">Status</th>
                                            <th scope="col">Used in</th>
                                            <th scope="col">Updated</th>
                                            <th scope="col"><span className="visually-hidden">Actions</span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.state.value.items.map( ( item ) => (
                                            <tr key={item.id}>
                                                <th scope="row">{item.title}</th>
                                                <td className={app.muted}>{TYPE_LABELS[item.type]}</td>
                                                <td><StatusBadge status={item.status} /></td>
                                                <td className={app.muted}>
                                                    {item.topicCount === 0 ? '—' : `${item.topicCount} ${item.topicCount === 1 ? 'topic' : 'topics'}`}
                                                </td>
                                                <td className={app.muted}>{formatUpdated( item.updatedAt, now )}</td>
                                                <td>
                                                    <div className={styles.rowActions}>
                                                        <button
                                                            type="button"
                                                            className={`${shared.button} ${shared.secondary} ${shared.small}`}
                                                            aria-label={`Edit ${item.title}`}
                                                            onClick={() => setEditing( item )}
                                                        >
                                                            <Icon name="edit" />
                                                            Edit
                                                        </button>
                                                        <Menu
                                                            label={`More for ${item.title}`}
                                                            actions={statusActions(
                                                                item.status,
                                                                ( to ) => void change( () => request( `/admin/catalog/items/${item.id}`, { method: 'PATCH', body: { status: to } } ) ),
                                                                () => void change( () => request( `/admin/catalog/items/${item.id}`, { method: 'DELETE' } ) ),
                                                            )}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        ) )}
                                    </tbody>
                                </table>
                            )}
                    {items.state.value.total > items.state.value.items.length && (
                        <p className={`${app.muted} ${app.small} ${styles.more}`}>
                            {`Showing ${items.state.value.items.length} of ${items.state.value.total}. Search to find the others.`}
                        </p>
                    )}
                </section>
            )}
            {( creating || editing ) && (
                <ItemDialog
                    item={editing}
                    onClose={() => {
                        setEditing( undefined );
                        onCreated();
                    }}
                    onSaved={() => {
                        setEditing( undefined );
                        onCreated();
                        items.reload();
                    }}
                />
            )}
        </>
    );
}

function StatusFilter( { value, onChange }: { value: CatalogStatus | ''; onChange: ( status: CatalogStatus | '' ) => void } ) {
    return (
        <label className={styles.filter}>
            <span className="visually-hidden">Status</span>
            <select className={form.input} value={value} onChange={( event ) => onChange( event.target.value as CatalogStatus | '' )}>
                <option value="">All statuses</option>
                {Object.values( CatalogStatus ).map( ( status ) => (
                    <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                ) )}
            </select>
        </label>
    );
}
