import type { StudySessionPageJson } from '@studylog/schemas';

import styles from './Dashboard.module.css';
import { formatMinutes, formatSessionStart } from './format.ts';

type Session = StudySessionPageJson['items'][number];

/** The latest study sessions: what was studied, when, for how long, and any notes. */
export function RecentSessions( { sessions, now }: { sessions: StudySessionPageJson; now: Date } ) {
    const { items, total } = sessions;

    return (
        <section className={styles.card} aria-labelledby="sessions-title">
            <div className={styles.cardHeader}>
                <h2 id="sessions-title" className={styles.cardTitle}>Recent sessions</h2>
                {total > items.length && <p className={styles.muted}>{`${total} in total`}</p>}
            </div>
            {items.length === 0 && (
                <p className={styles.empty}>No study sessions yet. Time you log will show up here.</p>
            )}
            {items.length > 0 && (
                <ol className={styles.sessions}>
                    {items.map( ( session ) => <SessionRow key={session.id} session={session} now={now} /> )}
                </ol>
            )}
        </section>
    );
}

function SessionRow( { session, now }: { session: Session; now: Date } ) {
    // The item says the most; its topic gives context. Either may be missing, or deleted since.
    const title = session.item?.title ?? session.topic?.title ?? 'Study session';
    const context = session.item && session.topic ? `${session.topic.title} · ` : '';

    return (
        <li className={styles.session}>
            <div className={styles.sessionMain}>
                <p className={styles.sessionTitle}>{title}</p>
                <p className={styles.muted}>{`${context}${formatSessionStart( new Date( session.startedAt ), now )}`}</p>
                {session.notes && <p className={styles.notes}>{session.notes}</p>}
            </div>
            <span className={styles.duration}>{formatMinutes( session.durationMinutes )}</span>
        </li>
    );
}
