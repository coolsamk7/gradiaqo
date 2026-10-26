import type { ReportJson, ReportPageJson } from '@studylog/schemas';
import { ReportAction } from '@studylog/schemas';
import { ReportStatus } from '@studylog/schemas/enums';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useLoaded } from '../../api/use-loaded.ts';
import { useAuth } from '../../auth/auth-context.ts';
import { AppLayout } from '../../components/AppLayout.tsx';
import { Icon } from '../../components/Icon.tsx';
import { CardSkeleton, LoadError, Loading } from '../../components/LoadStates.tsx';
import { fieldProps } from '../../forms/field-props.ts';
import { FormField } from '../../forms/FormField.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Admin.module.css';
import { AdminNav } from './AdminNav.tsx';
import { actionError, loadError, outcome, pathLine, REASON_LABELS, reporterLine, resolutionLine } from './reports.ts';

/** How many resolved reports the Open tab shows under the queue. */
const RECENT = 5;

/**
 * Public paths reported by users (Figma: M4 › Admin · Reports), for superadmins: the open ones to dismiss or hide,
 * and the resolved ones (`?tab=resolved`), where a path hidden by mistake can be un-hidden.
 */
export function ReportsPage() {
    const [ params, setParams ] = useSearchParams();
    const open = useLoaded<ReportPageJson>( '/admin/reports', loadError );
    const resolved = useLoaded<ReportPageJson>( '/admin/reports?status=resolved', loadError );
    const tab = params.get( 'tab' ) === 'resolved' ? 'resolved' : 'open';
    const reload = () => {
        open.reload();
        resolved.reload();
    };
    const shown = tab === 'open' ? open.state : resolved.state;

    return (
        <AppLayout>
            <div className={app.header}>
                <div className={app.titleBlock}>
                    <div className={styles.titleRow}>
                        <h1 className={app.title}>Reports</h1>
                        <span className={`${app.badge} ${app.badgeInverse}`}>Admin</span>
                    </div>
                    <p className={app.muted}>
                        Public paths reported by users. Hiding a path makes it private; its owner keeps it.
                    </p>
                </div>
            </div>
            <AdminNav />

            <div className={styles.views} role="tablist" aria-label="Reports">
                {( [ 'open', 'resolved' ] as const ).map( ( name ) => (
                    <button
                        key={name}
                        type="button"
                        role="tab"
                        id={`tab-${name}`}
                        className={styles.view}
                        aria-selected={tab === name}
                        aria-controls="tab-panel"
                        onClick={() => setParams( name === 'open' ? {} : { tab: name }, { replace: true } )}
                    >
                        {name === 'open'
                            ? `Open${open.state.status === 'ready' ? ` · ${open.state.value.total}` : ''}`
                            : 'Resolved'}
                    </button>
                ) )}
            </div>

            <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className={styles.stack}>
                {shown.status === 'loading' && (
                    <Loading text="Loading the reports…">
                        <CardSkeleton lines={4} />
                    </Loading>
                )}
                {shown.status === 'error' && <LoadError message={shown.message} retry={reload} />}
                {tab === 'open' && open.state.status === 'ready' && (
                    <>
                        {open.state.value.items.length === 0 && (
                            <section className={`${app.card} ${app.empty}`} aria-label="Open reports">
                                <p>Nothing to review. Reports from users show up here.</p>
                            </section>
                        )}
                        {open.state.value.items.map( ( report ) => (
                            <OpenReport key={report.id} report={report} onResolved={reload} />
                        ) )}
                        {resolved.state.status === 'ready' && resolved.state.value.items.length > 0 && (
                            <Resolved title="Recently resolved" reports={resolved.state.value.items.slice( 0, RECENT )} onChanged={reload} />
                        )}
                    </>
                )}
                {tab === 'resolved' && resolved.state.status === 'ready' && (
                    resolved.state.value.items.length === 0
                        ? (
                                <section className={`${app.card} ${app.empty}`} aria-label="Resolved reports">
                                    <p>No reports resolved yet.</p>
                                </section>
                            )
                        : <Resolved title="Resolved reports" reports={resolved.state.value.items} onChanged={reload} />
                )}
            </div>
        </AppLayout>
    );
}

/** One report to act on: what was reported and why, a note for the record, then Dismiss or Hide path. */
function OpenReport( { report, onResolved }: { report: ReportJson; onResolved: () => void } ) {
    const { request } = useAuth();
    const [ note, setNote ] = useState( '' );
    const [ busy, setBusy ] = useState<ReportAction>();
    const [ error, setError ] = useState<string>();
    const field = `note-${report.id}`;

    const resolve = async ( action: ReportAction ) => {
        setBusy( action );
        setError( undefined );
        try {
            await request( `/admin/reports/${report.id}`, {
                method: 'PATCH',
                body: { action, ...( note.trim() ? { note: note.trim() } : {} ) },
            } );
            onResolved();
        } catch ( failure ) {
            setError( actionError( failure ) );
            setBusy( undefined );
        }
    };

    return (
        <section className={`${app.card} ${styles.report}`} aria-label={`Report on ${report.learningPath.title}`}>
            <div className={styles.top}>
                <span className={styles.chip} aria-hidden="true"><Icon name="flag" /></span>
                <div className={styles.path}>
                    <p className={styles.pathTitle}>
                        {report.learningPath.title}
                        <span className={`${app.badge} ${app.badgeWarning}`}>Community</span>
                    </p>
                    <p className={`${app.muted} ${app.small}`}>{pathLine( report )}</p>
                </div>
                <span className={app.badge}>{`Reason: ${REASON_LABELS[report.reason]}`}</span>
            </div>
            <div className={styles.details}>
                <p>{report.details ? `“${report.details}”` : 'No details given.'}</p>
                <p className={`${app.muted} ${app.small}`}>{reporterLine( report, new Date() )}</p>
            </div>
            {error && <p className={app.error} role="alert">{error}</p>}
            <FormField field={field} label="Note (optional)">
                <textarea
                    {...fieldProps( field, undefined )}
                    rows={3}
                    maxLength={2000}
                    placeholder="Why you dismissed it or hid the path, for the record."
                    value={note}
                    onChange={( event ) => setNote( event.target.value )}
                />
            </FormField>
            <div className={styles.actions}>
                <Link to={`/app/catalog/${report.learningPath.id}`} className={`${shared.button} ${shared.secondary}`}>
                    <Icon name="eye" />
                    View path
                </Link>
                <span className={styles.spacer} />
                <button
                    type="button"
                    className={`${shared.button} ${shared.secondary}`}
                    disabled={busy !== undefined}
                    onClick={() => void resolve( ReportAction.Dismiss )}
                >
                    {busy === ReportAction.Dismiss ? 'Dismissing…' : 'Dismiss'}
                </button>
                <button
                    type="button"
                    className={`${shared.button} ${shared.danger}`}
                    disabled={busy !== undefined}
                    onClick={() => void resolve( ReportAction.HidePath )}
                >
                    {busy === ReportAction.HidePath ? 'Hiding…' : 'Hide path'}
                </button>
            </div>
        </section>
    );
}

/** Resolved reports, with Un-hide on paths that are still hidden. */
function Resolved( { title, reports, onChanged }: { title: string; reports: ReportJson[]; onChanged: () => void } ) {
    const { request } = useAuth();
    const [ busy, setBusy ] = useState<string>();
    const [ error, setError ] = useState<string>();

    const unhide = async ( report: ReportJson ) => {
        setBusy( report.id );
        setError( undefined );
        try {
            await request( `/admin/paths/${report.learningPath.id}/unhide`, { method: 'POST' } );
            onChanged();
        } catch ( failure ) {
            setError( actionError( failure ) );
        }
        setBusy( undefined );
    };

    return (
        <section className={app.card} aria-labelledby="resolved-title">
            <h2 id="resolved-title" className={`${app.cardTitle} ${styles.resolvedTitle}`}>{title}</h2>
            {error && <p className={app.error} role="alert">{error}</p>}
            <ul className={styles.rows}>
                {reports.map( ( report ) => (
                    <li key={report.id} className={styles.row}>
                        <div className={styles.copy}>
                            <p className={styles.strong}>{`${report.learningPath.title} · ${REASON_LABELS[report.reason]}`}</p>
                            <p className={`${app.muted} ${app.small}`}>{resolutionLine( report )}</p>
                        </div>
                        {report.status === ReportStatus.Actioned && report.learningPath.publicBlockedAt && (
                            <button
                                type="button"
                                className={`${shared.button} ${shared.ghost} ${shared.small}`}
                                disabled={busy !== undefined}
                                aria-label={`Un-hide ${report.learningPath.title}`}
                                onClick={() => void unhide( report )}
                            >
                                {busy === report.id ? 'Un-hiding…' : 'Un-hide'}
                            </button>
                        )}
                        <span className={app.badge}>{outcome( report )}</span>
                    </li>
                ) )}
            </ul>
        </section>
    );
}
