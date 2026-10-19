import type { EnrollmentDetailJson } from '@studylog/schemas';
import type { ProgressStatus } from '@studylog/schemas/enums';
import { EnrollmentStatus } from '@studylog/schemas/enums';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { AppHeader } from '../../components/AppHeader.tsx';
import { ProgressBar } from '../../components/ProgressBar.tsx';
import { percent } from '../../format/format.ts';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import { ItemRow } from './ItemRow.tsx';
import styles from './Path.module.css';
import { usePath } from './use-path.ts';

type Module = EnrollmentDetailJson['modules'][number];
type Topic = Module['topics'][number];

const ENROLLMENT_LABELS: Partial<Record<EnrollmentStatus, string>> = {
    [EnrollmentStatus.Paused]: 'Paused',
    [EnrollmentStatus.Completed]: 'Completed',
    [EnrollmentStatus.Dropped]: 'Dropped',
};

/** One learning path the user follows: its modules, topics and items, with progress, in the user's own order. */
export function PathPage() {
    const { enrollmentId = '' } = useParams();
    const { state, reload, setStatus } = usePath( enrollmentId );

    return (
        <div className={app.page}>
            <AppHeader />
            <main className={`${shared.container} ${app.main}`}>
                <Link to="/app" className={styles.back}>← Dashboard</Link>

                {state.status === 'loading' && (
                    <div className={app.status}>
                        <span className={app.spinner} aria-hidden="true" />
                        Loading the learning path…
                    </div>
                )}

                {state.status === 'error' && (
                    <div className={app.error} role="alert">
                        <p>{state.message}</p>
                        {!state.notFound && (
                            <button type="button" className={`${shared.button} ${shared.secondary} ${app.retry}`} onClick={reload}>
                                Try again
                            </button>
                        )}
                    </div>
                )}

                {state.status === 'ready' && <PathView path={state.path} onStatus={setStatus} />}
            </main>
        </div>
    );
}

interface PathViewProps {
    path: EnrollmentDetailJson;
    onStatus: ( itemId: string, status: ProgressStatus ) => Promise<void>;
}

function PathView( { path, onStatus }: PathViewProps ) {
    const { title, description } = path.learningPath;
    const { completed, total } = path.progress;
    const status = ENROLLMENT_LABELS[path.status];
    // Open where the user left off: the first topic with required items still to do. Chosen once, so finishing a
    // topic doesn't close it under the user.
    const [ firstOpen ] = useState( () => path.modules
        .flatMap( ( module ) => module.topics )
        .find( isUnfinished )?.id );

    return (
        <>
            <div className={styles.header}>
                <div className={styles.titleRow}>
                    <h1 className={app.title}>{title}</h1>
                    {status && <span className={styles.badge}>{status}</span>}
                </div>
                {description && <p className={app.muted}>{description}</p>}
                <ProgressBar label={`${title} progress`} percent={percent( completed, total )} />
                <p className={app.muted}>{`${completed} of ${total} items done · ${percent( completed, total )}%`}</p>
            </div>

            {path.modules.length === 0 && <p className={app.empty}>This path has no content yet.</p>}

            {path.modules.map( ( module ) => (
                <section key={module.id} className={app.card} aria-labelledby={`module-${module.id}`}>
                    <div className={app.cardHeader}>
                        <h2 id={`module-${module.id}`} className={app.cardTitle}>{module.title}</h2>
                        <p className={app.muted}>{`${module.progress.completed} of ${module.progress.total} done`}</p>
                    </div>
                    {module.description && <p className={`${app.muted} ${styles.moduleDescription}`}>{module.description}</p>}
                    <ProgressBar label={`${module.title} progress`} percent={percent( module.progress.completed, module.progress.total )} />
                    <div className={styles.topics}>
                        {module.topics.map( ( topic ) => (
                            <TopicSection
                                key={topic.id}
                                topic={topic}
                                enrollmentId={path.id}
                                initiallyOpen={topic.id === firstOpen}
                                onStatus={onStatus}
                            />
                        ) )}
                    </div>
                </section>
            ) )}
        </>
    );
}

interface TopicSectionProps {
    topic: Topic;
    enrollmentId: string;
    initiallyOpen: boolean;
    onStatus: ( itemId: string, status: ProgressStatus ) => Promise<void>;
}

function TopicSection( { topic, enrollmentId, initiallyOpen, onStatus }: TopicSectionProps ) {
    const { completed, total } = topic.progress;

    // `initiallyOpen` never changes for a topic, so after the first render the browser keeps the open state.
    return (
        <details className={styles.topic} open={initiallyOpen}>
            <summary className={styles.topicSummary}>
                <h3 className={styles.topicTitle}>{topic.title}</h3>
                <span className={total > 0 && completed === total ? styles.countDone : styles.count}>{`${completed}/${total}`}</span>
            </summary>
            {topic.description && <p className={`${app.muted} ${styles.topicDescription}`}>{topic.description}</p>}
            {topic.items.length === 0 && <p className={styles.noItems}>No items in this topic yet.</p>}
            {topic.items.length > 0 && (
                <ul className={styles.items}>
                    {topic.items.map( ( item ) => (
                        <ItemRow
                            key={item.id}
                            item={item}
                            enrollmentId={enrollmentId}
                            topicId={topic.id}
                            onStatus={onStatus}
                        />
                    ) )}
                </ul>
            )}
        </details>
    );
}

function isUnfinished( topic: Topic ): boolean {
    return topic.progress.completed < topic.progress.total;
}
