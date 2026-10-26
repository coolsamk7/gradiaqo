import type { AuditPageJson } from '@studylog/schemas';
import { AuditArea } from '@studylog/schemas';
import { useState } from 'react';

import { useLoaded } from '../../api/use-loaded.ts';
import { AppLayout } from '../../components/AppLayout.tsx';
import { CardSkeleton, LoadError, Loading } from '../../components/LoadStates.tsx';
import form from '../../forms/form.module.css';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Admin.module.css';
import { AdminNav } from './AdminNav.tsx';
import { AREA_LABELS, auditSentence, auditUrl, when } from './audit.ts';
import { loadError } from './catalog.ts';
import { PAGE_SIZE, pageLabel } from './users.ts';

/**
 * What superadmins did, newest first: users promoted, demoted or removed; global paths and items published, archived
 * or deleted; reports dismissed and paths hidden or un-hidden.
 */
export function AuditPage() {
    const [ area, setArea ] = useState<AuditArea | ''>( '' );
    const [ offset, setOffset ] = useState( 0 );
    const events = useLoaded<AuditPageJson>( auditUrl( area, offset ), loadError );
    const page = events.state.status === 'ready' ? events.state.value : undefined;
    const now = new Date();

    return (
        <AppLayout>
            <div className={app.header}>
                <div className={app.titleBlock}>
                    <div className={styles.titleRow}>
                        <h1 className={app.title}>Audit log</h1>
                        <span className={`${app.badge} ${app.badgeInverse}`}>Admin</span>
                    </div>
                    <p className={app.muted}>What superadmins did, newest first. Names are as they were at the time.</p>
                </div>
            </div>
            <AdminNav />

            <div className={styles.toolbar}>
                <label className={styles.filter}>
                    <span className="visually-hidden">Area</span>
                    <select
                        className={form.input}
                        value={area}
                        onChange={( event ) => {
                            setArea( event.target.value as AuditArea | '' );
                            setOffset( 0 );
                        }}
                    >
                        <option value="">Everything</option>
                        {Object.values( AuditArea ).map( ( value ) => (
                            <option key={value} value={value}>{AREA_LABELS[value]}</option>
                        ) )}
                    </select>
                </label>
            </div>
            {events.state.status === 'loading' && <Loading text="Loading the audit log…"><CardSkeleton lines={4} /></Loading>}
            {events.state.status === 'error' && <LoadError message={events.state.message} retry={events.reload} />}
            {page && (
                <section className={app.card} aria-label="Audit log">
                    {page.items.length === 0
                        ? <p className={app.empty}>Nothing recorded yet.</p>
                        : (
                                <ol className={styles.rows}>
                                    {page.items.map( ( event ) => (
                                        <li key={event.id} className={styles.row}>
                                            <div className={styles.copy}>
                                                <p>
                                                    <span className={styles.strong}>{event.actor.name}</span>
                                                    {` ${auditSentence( event )}`}
                                                </p>
                                                {event.note && <p className={`${app.muted} ${app.small}`}>{`“${event.note}”`}</p>}
                                            </div>
                                            <span className={`${app.muted} ${app.small}`}>{when( event, now )}</span>
                                        </li>
                                    ) )}
                                </ol>
                            )}
                    {page.total > PAGE_SIZE && (
                        <div className={styles.pager}>
                            <p className={`${app.muted} ${app.small}`}>{pageLabel( offset, page.items.length, page.total )}</p>
                            <button
                                type="button"
                                className={`${shared.button} ${shared.secondary} ${shared.small}`}
                                disabled={offset === 0}
                                onClick={() => setOffset( offset - PAGE_SIZE )}
                            >
                                Newer
                            </button>
                            <button
                                type="button"
                                className={`${shared.button} ${shared.secondary} ${shared.small}`}
                                disabled={offset + PAGE_SIZE >= page.total}
                                onClick={() => setOffset( offset + PAGE_SIZE )}
                            >
                                Older
                            </button>
                        </div>
                    )}
                </section>
            )}
        </AppLayout>
    );
}
