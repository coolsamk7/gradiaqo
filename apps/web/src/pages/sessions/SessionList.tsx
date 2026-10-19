import { useState } from 'react';

import { ApiError } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';
import { Icon } from '../../components/Icon.tsx';
import { describeSession, formatMinutes, formatTime, relativeDay, toDateInput } from '../../format/format.ts';
import form from '../../forms/form.module.css';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import { SessionForm } from './SessionForm.tsx';
import styles from './Sessions.module.css';
import type { Session } from './use-sessions.ts';

interface SessionListProps {
    items: Session[];
    now: Date;
    /** A session was changed or deleted: show `message` and reload the list. */
    onChanged: ( message: string ) => void;
}

const ghost = `${shared.button} ${shared.ghost} ${shared.small}`;

/** Sessions grouped by local day, newest first, each with its day's total. */
export function SessionList( { items, now, onChanged }: SessionListProps ) {
    const days = groupByDay( items );

    return (
        <div className={styles.days}>
            {days.map( ( day ) => {
                const minutes = day.sessions.reduce( ( sum, session ) => sum + session.durationMinutes, 0 );
                const heading = relativeDay( new Date( day.sessions[0].startedAt ), now );

                return (
                    <section key={day.key} className={app.card} aria-label={heading}>
                        <div className={app.cardHeader}>
                            <h2 className={app.cardTitle}>{heading}</h2>
                            <p className={`${app.muted} ${app.small}`}>{`${formatMinutes( minutes )} studied`}</p>
                        </div>
                        <ol className={app.sessions}>
                            {day.sessions.map( ( session ) => (
                                <SessionItem key={session.id} session={session} onChanged={onChanged} />
                            ) )}
                        </ol>
                    </section>
                );
            } )}
        </div>
    );
}

function SessionItem( { session, onChanged }: { session: Session; onChanged: ( message: string ) => void } ) {
    const { request } = useAuth();
    const [ mode, setMode ] = useState<'view' | 'edit' | 'confirmDelete' | 'deleting'>( 'view' );
    const [ error, setError ] = useState<string>();
    const { title, context } = describeSession( session );
    const time = formatTime( new Date( session.startedAt ) );

    if ( mode === 'edit' ) {
        return (
            <li className={app.session}>
                <SessionForm
                    session={session}
                    about={context ? `${title} · ${context}` : title}
                    onSaved={onChanged}
                    onCancel={() => setMode( 'view' )}
                />
            </li>
        );
    }

    const onDelete = async () => {
        setMode( 'deleting' );
        setError( undefined );
        try {
            await request( `/me/study-sessions/${session.id}`, { method: 'DELETE' } );
            onChanged( 'Session deleted.' );
        } catch ( failure ) {
            // Already gone (deleted elsewhere): that's what the user wanted.
            if ( failure instanceof ApiError && failure.status === 404 ) {
                onChanged( 'Session deleted.' );

                return;
            }
            setError( 'Couldn\'t delete this session. Please try again.' );
            setMode( 'confirmDelete' );
        }
    };

    return (
        <li className={app.session}>
            <span className={app.sessionIcon} aria-hidden="true"><Icon name="book-open" /></span>
            <div className={app.sessionMain}>
                <p className={app.sessionTitle}>{title}</p>
                <p className={`${app.muted} ${app.small}`}>{context ? `${context} · ${time}` : time}</p>
                {session.notes && <p className={app.notes}>{session.notes}</p>}
                {error && <p className={form.fieldError} role="alert">{error}</p>}
                {mode === 'view' && (
                    <div className={styles.rowActions}>
                        <button type="button" className={ghost} onClick={() => setMode( 'edit' )}>Edit</button>
                        <button type="button" className={ghost} onClick={() => setMode( 'confirmDelete' )}>Delete</button>
                    </div>
                )}
                {mode !== 'view' && (
                    <div className={styles.rowActions} role="group" aria-label="Delete this session?">
                        <span className={styles.confirm}>Delete this session?</span>
                        <button type="button" className={`${shared.button} ${shared.danger} ${shared.small}`} disabled={mode === 'deleting'} onClick={() => void onDelete()}>
                            Delete
                        </button>
                        <button type="button" className={ghost} disabled={mode === 'deleting'} onClick={() => setMode( 'view' )}>
                            Keep
                        </button>
                    </div>
                )}
            </div>
            <span className={app.duration}>{formatMinutes( session.durationMinutes )}</span>
        </li>
    );
}

/** Consecutive sessions on the same local day, in the order given. */
function groupByDay( sessions: Session[] ): { key: string; sessions: [ Session, ...Session[] ] }[] {
    const days: { key: string; sessions: [ Session, ...Session[] ] }[] = [];

    for ( const session of sessions ) {
        const key = toDateInput( new Date( session.startedAt ) );
        const last = days.at( -1 );

        if ( last?.key === key ) {
            last.sessions.push( session );
        } else {
            days.push( { key, sessions: [ session ] } );
        }
    }

    return days;
}
