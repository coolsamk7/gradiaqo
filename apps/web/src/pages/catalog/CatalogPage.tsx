import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useAuth } from '../../auth/auth-context.ts';
import { AppLayout } from '../../components/AppLayout.tsx';
import { Icon } from '../../components/Icon.tsx';
import { LoadError, Loading } from '../../components/LoadStates.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Catalog.module.css';
import { isSource, SOURCES } from './catalog-paths.ts';
import { CatalogSkeleton } from './CatalogSkeleton.tsx';
import { PathCard } from './PathCard.tsx';
import { useCatalog } from './use-catalog.ts';

/** How long typing must pause before searching. */
export const SEARCH_DELAY_MS = 300;

/**
 * Learning paths to follow (Figma: M1 › Browse paths). The filter and search live in the URL (`?source=`, `?q=`),
 * so they survive a reload and the back button.
 */
export function CatalogPage() {
    const { state: auth } = useAuth();
    // Only rendered inside <RequireAuth>, so there is a session.
    const { user } = ( auth as Extract<typeof auth, { status: 'authenticated' }> ).session;
    const [ params, setParams ] = useSearchParams();
    const sourceParam = params.get( 'source' );
    const source = isSource( sourceParam ) ? sourceParam : undefined;
    const search = params.get( 'q' )?.trim() ?? '';
    const [ typed, setTyped ] = useState( search );
    const { state, reload } = useCatalog( source, search );

    // Search once typing pauses.
    useEffect( () => {
        if ( typed.trim() === search ) {
            return undefined;
        }

        const timer = setTimeout( () => setParams( ( current ) => {
            const next = new URLSearchParams( current );

            if ( typed.trim() ) {
                next.set( 'q', typed.trim() );
            } else {
                next.delete( 'q' );
            }

            return next;
        }, { replace: true } ), SEARCH_DELAY_MS );

        return () => clearTimeout( timer );
    }, [ typed, search, setParams ] );

    const choose = ( value: string | undefined ) => setParams( ( current ) => {
        const next = new URLSearchParams( current );

        if ( value ) {
            next.set( 'source', value );
        } else {
            next.delete( 'source' );
        }

        return next;
    } );

    return (
        <AppLayout>
            <div className={app.header}>
                <div className={app.titleBlock}>
                    <h1 className={app.title}>Browse paths</h1>
                    <p className={app.muted}>
                        Find a learning path to follow: the official catalog, your organizations&apos; paths and paths
                        shared by the community.
                    </p>
                </div>
            </div>

            <div className={styles.toolbar}>
                <div className={styles.filters} role="group" aria-label="Show">
                    {SOURCES.map( ( option ) => (
                        <button
                            key={option.label}
                            type="button"
                            className={styles.filter}
                            aria-pressed={option.source === source}
                            onClick={() => choose( option.source )}
                        >
                            {option.label}
                        </button>
                    ) )}
                </div>
                <label className={styles.search}>
                    <Icon name="search" />
                    <span className="visually-hidden">Search paths</span>
                    <input type="search" placeholder="Search paths" value={typed} onChange={( event ) => setTyped( event.target.value )} />
                </label>
            </div>

            {state.status === 'loading' && <Loading text="Loading paths…"><CatalogSkeleton /></Loading>}

            {state.status === 'error' && <LoadError message={state.message} retry={reload} />}

            {state.status === 'ready' && state.paths.length === 0 && (
                <section className={`${app.card} ${styles.empty}`} aria-labelledby="empty-title">
                    <span className={styles.chip}><Icon name={search ? 'search' : 'compass'} size={20} /></span>
                    <h2 id="empty-title" className={app.cardTitle}>{search ? `No paths match “${search}”` : 'No paths here yet'}</h2>
                    <p className={`${app.muted} ${styles.emptyText}`}>
                        {search
                            ? 'Try another word or another filter, or build your own path from your notes and problems.'
                            : 'Paths appear here once they\'re published. Try another filter, or build your own path.'}
                    </p>
                    <Link to="/app/my-paths" className={`${shared.button} ${shared.secondary}`}>Build a path</Link>
                </section>
            )}

            {state.status === 'ready' && state.paths.length > 0 && (
                <ul className={styles.grid} aria-label="Learning paths">
                    {state.paths.map( ( path ) => <PathCard key={path.id} path={path} userId={user.id} /> )}
                </ul>
            )}
        </AppLayout>
    );
}
