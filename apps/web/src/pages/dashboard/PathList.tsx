import type { EnrollmentJson } from '@studylog/schemas';
import { EnrollmentStatus } from '@studylog/schemas/enums';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router';

import { NetworkError } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';
import { MoveButtons } from '../../components/MoveButtons.tsx';
import { ProgressBar } from '../../components/ProgressBar.tsx';
import { percent } from '../../format/format.ts';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import { moved } from '../my-paths/builder-tree.ts';
import styles from './Dashboard.module.css';

const STATUS_LABELS: Partial<Record<EnrollmentStatus, string>> = {
    [EnrollmentStatus.Paused]: 'Paused',
    [EnrollmentStatus.Completed]: 'Completed',
};

interface PathListProps {
    enrollments: EnrollmentJson[];
    /** The list in its new order, after the user moved a path. */
    onReordered: ( enrollments: EnrollmentJson[] ) => void;
}

/**
 * The learning paths the user follows, in their dashboard order, with progress. Dropped paths are left out.
 * "Reorder" shows buttons to move each path up or down; every move is saved right away.
 */
export function PathList( { enrollments, onReordered }: PathListProps ) {
    const { request } = useAuth();
    const [ reordering, setReordering ] = useState( false );
    const [ saving, setSaving ] = useState( false );
    const [ error, setError ] = useState<string>();
    const shown = enrollments.filter( ( enrollment ) => enrollment.status !== EnrollmentStatus.Dropped );

    const move = async ( id: string, by: -1 | 1 ) => {
        // The API wants every enrollment: dropped ones keep their place after the shown ones.
        const ids = [
            ...moved( shown.map( ( enrollment ) => enrollment.id ), id, by ),
            ...enrollments
                .filter( ( enrollment ) => enrollment.status === EnrollmentStatus.Dropped )
                .map( ( enrollment ) => enrollment.id ),
        ];

        setSaving( true );
        setError( undefined );
        try {
            onReordered( await request<EnrollmentJson[]>( '/me/enrollments/order', { method: 'PUT', body: { ids } } ) );
        } catch ( failure ) {
            setError( failure instanceof NetworkError
                ? 'Can\'t reach Gradiaqo right now. Check your connection and try again.'
                : 'Something went wrong, so the order wasn\'t changed. Please try again.' );
        }
        setSaving( false );
    };

    return (
        <section className={app.card} aria-labelledby="paths-title">
            <div className={app.cardHeader}>
                <h2 id="paths-title" className={app.cardTitle}>Your learning paths</h2>
                {shown.length > 1 && (
                    <button
                        type="button"
                        className={`${shared.button} ${shared.ghost} ${shared.small}`}
                        aria-pressed={reordering}
                        onClick={() => setReordering( !reordering )}
                    >
                        {reordering ? 'Done' : 'Reorder'}
                    </button>
                )}
            </div>
            {error && <p className={app.error} role="alert">{error}</p>}
            {shown.length === 0 && <p className={app.empty}>You aren&apos;t following any learning paths yet.</p>}
            {shown.length > 0 && (
                <ul className={styles.paths}>
                    {shown.map( ( enrollment, index ) => (
                        <PathRow key={enrollment.id} enrollment={enrollment}>
                            {reordering && (
                                <MoveButtons
                                    name={enrollment.learningPath.title}
                                    first={index === 0}
                                    last={index === shown.length - 1}
                                    disabled={saving}
                                    onMove={( by ) => void move( enrollment.id, by )}
                                />
                            )}
                        </PathRow>
                    ) )}
                </ul>
            )}
        </section>
    );
}

function PathRow( { enrollment, children }: { enrollment: EnrollmentJson; children: ReactNode } ) {
    const { title } = enrollment.learningPath;
    const { completed, total } = enrollment.progress;
    const done = percent( completed, total );
    const status = STATUS_LABELS[enrollment.status];

    return (
        <li className={styles.path}>
            <div className={styles.pathHeader}>
                {children}
                <h3 className={styles.pathTitle}>
                    <Link to={`/app/paths/${enrollment.id}`} className={styles.pathLink}>{title}</Link>
                </h3>
                {status && <span className={`${app.badge} ${enrollment.status === EnrollmentStatus.Completed ? app.badgeSuccess : ''}`}>{status}</span>}
                <span className={`${app.mono} ${app.muted}`}>{`${done}%`}</span>
            </div>
            <ProgressBar label={`${title} progress`} percent={done} />
            <p className={`${app.muted} ${app.small}`}>{`${completed} of ${total} items done`}</p>
        </li>
    );
}
