import type { EnrollmentStatus } from '@studylog/schemas/enums';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { useAuth } from '../../auth/auth-context.ts';
import { AppLayout } from '../../components/AppLayout.tsx';
import dialog from '../../components/Dialog.module.css';
import { Dialog } from '../../components/Dialog.tsx';
import { Icon } from '../../components/Icon.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import { ChoosePartsDialog } from '../path-preview/ChoosePartsDialog.tsx';
import { describeParts, followedTopics, rulesFor } from '../path-preview/parts.ts';
import { OrderCard } from './OrderCard.tsx';
import styles from './PathSettings.module.css';
import { formatSince, saveError, STATUSES } from './settings.ts';
import type { SettingsData } from './use-path-settings.ts';
import { usePathSettings } from './use-path-settings.ts';

/**
 * How the user follows one path (Figma: M1 › Path settings): pause or resume it, change which parts they follow
 * and the order they study them in, or leave it.
 */
export function PathSettingsPage() {
    const { enrollmentId = '' } = useParams();
    const { state, reload, refresh } = usePathSettings( enrollmentId );
    const title = state.status === 'ready' ? state.data.enrollment.learningPath.title : 'Learning path';

    return (
        <AppLayout>
            <Link
                to={`/app/paths/${enrollmentId}`}
                className={`${shared.button} ${shared.ghost} ${shared.small} ${styles.back}`}
                aria-label={`Back to ${title}`}
            >
                <Icon name="chevron-left" />
                {title}
            </Link>

            {state.status === 'loading' && (
                <div className={app.status} role="status">
                    <span className={app.spinner} aria-hidden="true" />
                    Loading the settings…
                </div>
            )}

            {state.status === 'error' && (
                <div className={app.error} role="alert">
                    <p>{state.message}</p>
                    {!state.notFound && (
                        <button type="button" className={`${shared.button} ${shared.secondary} ${shared.small}`} onClick={reload}>
                            Try again
                        </button>
                    )}
                </div>
            )}

            {state.status === 'ready' && <Settings data={state.data} onChanged={refresh} />}
        </AppLayout>
    );
}

function Settings( { data, onChanged }: { data: SettingsData; onChanged: () => Promise<void> } ) {
    const { request } = useAuth();
    const navigate = useNavigate();
    const { enrollment, path } = data;
    const [ editing, setEditing ] = useState( false );
    const [ leaving, setLeaving ] = useState( false );
    const [ busy, setBusy ] = useState( false );
    const [ error, setError ] = useState<string>();
    const status = STATUSES[enrollment.status];
    const url = `/me/enrollments/${enrollment.id}`;

    const setStatus = async ( to: EnrollmentStatus ) => {
        setBusy( true );
        setError( undefined );
        try {
            await request( url, { method: 'PATCH', body: { status: to } } );
            await onChanged();
        } catch ( failure ) {
            setError( saveError( failure, 'the status wasn\'t changed' ) );
        }
        setBusy( false );
    };

    const saveParts = async ( ticked: Set<string> ): Promise<string | undefined> => {
        try {
            await request( `${url}/rules`, { method: 'PUT', body: { rules: rulesFor( path!.modules, ticked, enrollment.rules ) } } );
        } catch ( failure ) {
            return saveError( failure, 'what you follow wasn\'t changed' );
        }
        setEditing( false );
        await onChanged();

        return undefined;
    };

    return (
        <>
            <div className={app.titleBlock}>
                <h1 className={app.title}>Path settings</h1>
                <p className={app.muted}>{`${enrollment.learningPath.title} · followed since ${formatSince( enrollment.enrolledAt, new Date() )}`}</p>
            </div>

            {error && <p className={app.error} role="alert">{error}</p>}

            <div className={styles.cards}>
                <section className={`${app.card} ${styles.row}`} aria-labelledby="status-title">
                    <div className={styles.copy}>
                        <div className={styles.titleRow}>
                            <h2 id="status-title" className={app.cardTitle}>Status</h2>
                            <span className={`${app.badge} ${status.tone === 'success' ? app.badgeSuccess : ''}`}>{status.label}</span>
                        </div>
                        <p className={`${app.muted} ${app.small}`}>{status.text}</p>
                    </div>
                    {status.action && (
                        <button
                            type="button"
                            className={`${shared.button} ${shared.secondary}`}
                            disabled={busy}
                            onClick={() => void setStatus( status.action!.to )}
                        >
                            <Icon name={status.action.icon} />
                            {status.action.label}
                        </button>
                    )}
                </section>

                <section className={`${app.card} ${styles.row}`} aria-labelledby="parts-title">
                    <div className={styles.copy}>
                        <h2 id="parts-title" className={app.cardTitle}>What you follow</h2>
                        <p className={`${app.muted} ${app.small}`}>
                            {path
                                ? describeParts( path.modules, followedTopics( path.modules, enrollment ) )
                                : 'This path isn\'t published any more, so what you follow can\'t be changed.'}
                        </p>
                    </div>
                    {path && (
                        <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={() => setEditing( true )}>
                            <Icon name="edit" />
                            Edit parts
                        </button>
                    )}
                </section>

                <OrderCard enrollment={enrollment} onChanged={onChanged} />

                <section className={`${app.card} ${styles.row} ${styles.danger}`} aria-labelledby="leave-title">
                    <div className={styles.copy}>
                        <h2 id="leave-title" className={app.cardTitle}>Leave this path</h2>
                        <p className={`${app.muted} ${app.small}`}>
                            It disappears from your dashboard. Your progress and study sessions are kept, so you can
                            enroll again any time.
                        </p>
                    </div>
                    <button type="button" className={`${shared.button} ${shared.danger}`} onClick={() => setLeaving( true )}>
                        Leave path
                    </button>
                </section>
            </div>

            {editing && path && (
                <ChoosePartsDialog
                    modules={path.modules}
                    initial={followedTopics( path.modules, enrollment )}
                    confirm="Save"
                    onConfirm={saveParts}
                    onClose={() => setEditing( false )}
                />
            )}

            {leaving && (
                <LeaveDialog
                    title={enrollment.learningPath.title}
                    onLeave={async () => {
                        await request( url, { method: 'DELETE' } );
                        void navigate( '/app' );
                    }}
                    onClose={() => setLeaving( false )}
                />
            )}
        </>
    );
}

interface LeaveDialogProps {
    title: string;
    /** Rejects if leaving failed. */
    onLeave: () => Promise<void>;
    onClose: () => void;
}

/** Asks before leaving a path (Figma: Dialogs › Path settings · leave). */
function LeaveDialog( { title, onLeave, onClose }: LeaveDialogProps ) {
    const [ leaving, setLeaving ] = useState( false );
    const [ error, setError ] = useState<string>();

    const leave = async () => {
        setLeaving( true );
        setError( undefined );
        try {
            await onLeave();
        } catch ( failure ) {
            setError( saveError( failure, 'you didn\'t leave the path' ) );
            setLeaving( false );
        }
    };

    return (
        <Dialog
            title={`Leave ${title}?`}
            description="It disappears from your dashboard. Your progress and study sessions are kept, so you can enroll again any time."
            onClose={onClose}
        >
            {error && <p className={app.error} role="alert">{error}</p>}
            <div className={dialog.actions}>
                <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={onClose}>Cancel</button>
                <button type="button" className={`${shared.button} ${shared.danger}`} disabled={leaving} onClick={() => void leave()}>
                    {leaving ? 'Leaving…' : 'Leave path'}
                </button>
            </div>
        </Dialog>
    );
}
