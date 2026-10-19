import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { AppLayout } from '../../components/AppLayout.tsx';
import { Icon } from '../../components/Icon.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import { SessionForm } from './SessionForm.tsx';
import { SessionList } from './SessionList.tsx';
import styles from './Sessions.module.css';
import { useSessions } from './use-sessions.ts';

/**
 * The user's study history, and where they log new sessions. `?log` opens the form right away, and `path`, `topic`
 * and `item` (ids) choose what the new session is about.
 */
export function SessionsPage() {
    const [ params ] = useSearchParams();
    const [ logging, setLogging ] = useState( params.has( 'log' ) );
    const [ notice, setNotice ] = useState<string>();
    const { state, reload, loadMore } = useSessions();
    const now = new Date();
    // What a new session is about, when coming from "Log time" on an item.
    const chosen = { path: params.get( 'path' ) ?? '', topic: params.get( 'topic' ) ?? '', item: params.get( 'item' ) ?? '' };

    const onChanged = ( message: string ) => {
        setLogging( false );
        setNotice( message );
        reload();
    };

    const openForm = () => {
        setNotice( undefined );
        setLogging( true );
    };

    return (
        <AppLayout>
            <div className={app.header}>
                <div className={app.titleBlock}>
                    <h1 className={app.title}>Study sessions</h1>
                    <p className={app.muted}>
                        {state.status === 'ready' && state.total > 0 ? countSessions( state.total ) : 'Log the time you spend studying.'}
                    </p>
                </div>
                {!logging && (
                    <button type="button" className={`${shared.button} ${shared.primary}`} onClick={openForm}>
                        <Icon name="plus" />
                        Log session
                    </button>
                )}
            </div>

            {/* Always in the page, so screen readers announce the message when it appears. */}
            <p className={styles.notice} role="status">
                {notice && <Icon name="check-circle" />}
                {notice}
            </p>

            {logging && (
                <section className={app.card} aria-labelledby="log-title">
                    <div className={app.cardHeader}>
                        <h2 id="log-title" className={app.cardTitle}>Log a study session</h2>
                    </div>
                    <SessionForm
                        initial={chosen}
                        onSaved={onChanged}
                        onCancel={() => setLogging( false )}
                    />
                </section>
            )}

            {state.status === 'loading' && (
                <div className={app.status}>
                    <span className={app.spinner} aria-hidden="true" />
                    Loading your sessions…
                </div>
            )}

            {state.status === 'error' && (
                <div className={app.error} role="alert">
                    <p>{state.message}</p>
                    <button type="button" className={`${shared.button} ${shared.secondary} ${shared.small}`} onClick={reload}>
                        Try again
                    </button>
                </div>
            )}

            {state.status === 'ready' && state.items.length === 0 && (
                <p className={app.empty}>No study sessions yet. Log your first one to start your streak.</p>
            )}

            {state.status === 'ready' && state.items.length > 0 && (
                <>
                    <SessionList items={state.items} now={now} onChanged={onChanged} />
                    {state.moreError && <p className={app.error} role="alert">{state.moreError}</p>}
                    {state.items.length < state.total && (
                        <button
                            type="button"
                            className={`${shared.button} ${shared.secondary} ${styles.loadMore}`}
                            disabled={state.loadingMore}
                            onClick={loadMore}
                        >
                            {state.loadingMore ? 'Loading…' : `Show more (${state.total - state.items.length} left)`}
                        </button>
                    )}
                </>
            )}
        </AppLayout>
    );
}

function countSessions( total: number ): string {
    return total === 1 ? '1 session logged' : `${total} sessions logged`;
}
