import type { EnrollmentJson } from '@studylog/schemas';
import { EnrollmentStatus } from '@studylog/schemas/enums';

import { percent } from '../../format/format.ts';
import app from '../../styles/app.module.css';
import styles from './Dashboard.module.css';

const STATUS_LABELS: Partial<Record<EnrollmentStatus, string>> = {
    [EnrollmentStatus.Paused]: 'Paused',
    [EnrollmentStatus.Completed]: 'Completed',
};

/** The learning paths the user follows, in their dashboard order, with progress. Dropped paths are left out. */
export function PathList( { enrollments }: { enrollments: EnrollmentJson[] } ) {
    const shown = enrollments.filter( ( enrollment ) => enrollment.status !== EnrollmentStatus.Dropped );

    return (
        <section className={app.card} aria-labelledby="paths-title">
            <div className={app.cardHeader}>
                <h2 id="paths-title" className={app.cardTitle}>Your learning paths</h2>
            </div>
            {shown.length === 0 && <p className={app.empty}>You aren&apos;t following any learning paths yet.</p>}
            {shown.length > 0 && (
                <ul className={styles.paths}>
                    {shown.map( ( enrollment ) => <PathRow key={enrollment.id} enrollment={enrollment} /> )}
                </ul>
            )}
        </section>
    );
}

function PathRow( { enrollment }: { enrollment: EnrollmentJson } ) {
    const { title } = enrollment.learningPath;
    const { completed, total } = enrollment.progress;
    const done = percent( completed, total );
    const status = STATUS_LABELS[enrollment.status];

    return (
        <li className={styles.path}>
            <div className={styles.pathHeader}>
                <h3 className={styles.pathTitle}>{title}</h3>
                {status && <span className={styles.badge}>{status}</span>}
                <span className={styles.percent}>{`${done}%`}</span>
            </div>
            <div
                className={styles.track}
                role="progressbar"
                aria-label={`${title} progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={done}
            >
                <div className={styles.fill} style={{ width: `${done}%` }} />
            </div>
            <p className={app.muted}>{`${completed} of ${total} items done`}</p>
        </li>
    );
}
