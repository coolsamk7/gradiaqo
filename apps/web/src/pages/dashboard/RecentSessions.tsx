import type { StudySessionPageJson } from '@studylog/schemas';
import { Link } from 'react-router';

import { describeSession, formatMinutes, formatSessionStart } from '../../format/format.ts';
import app from '../../styles/app.module.css';

type Session = StudySessionPageJson['items'][number];

/** The latest study sessions: what was studied, when, for how long, and any notes. */
export function RecentSessions( { sessions, now }: { sessions: StudySessionPageJson; now: Date } ) {
    const { items, total } = sessions;

    return (
        <section className={app.card} aria-labelledby="sessions-title">
            <div className={app.cardHeader}>
                <h2 id="sessions-title" className={app.cardTitle}>Recent sessions</h2>
                {total > 0 && <Link to="/app/sessions" className={app.cardLink}>{`View all ${total}`}</Link>}
            </div>
            {items.length === 0 && (
                <p className={app.empty}>No study sessions yet. Time you log will show up here.</p>
            )}
            {items.length > 0 && (
                <ol className={app.sessions}>
                    {items.map( ( session ) => <SessionRow key={session.id} session={session} now={now} /> )}
                </ol>
            )}
        </section>
    );
}

function SessionRow( { session, now }: { session: Session; now: Date } ) {
    const { title, context } = describeSession( session );
    const when = formatSessionStart( new Date( session.startedAt ), now );

    return (
        <li className={app.session}>
            <div className={app.sessionMain}>
                <p className={app.sessionTitle}>{title}</p>
                <p className={app.muted}>{context ? `${context} · ${when}` : when}</p>
                {session.notes && <p className={app.notes}>{session.notes}</p>}
            </div>
            <span className={app.duration}>{formatMinutes( session.durationMinutes )}</span>
        </li>
    );
}
