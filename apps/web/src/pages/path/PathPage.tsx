import type { EnrollmentDetailJson } from '@studylog/schemas';
import type { ProgressStatus } from '@studylog/schemas/enums';
import { EnrollmentStatus } from '@studylog/schemas/enums';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { AppLayout } from '../../components/AppLayout.tsx';
import { Icon } from '../../components/Icon.tsx';
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

/**
 * One learning path the user follows: its modules, topics and items, with progress, in the user's own order.
 * `?topic=` (an id) opens that topic and scrolls to it, e.g. from "Open topic" on Analytics.
 */
export function PathPage() {
    const { enrollmentId = '' } = useParams();
    const { state, reload, setStatus } = usePath( enrollmentId );

    return (
        <AppLayout>
            <Link to="/app" className={`${shared.button} ${shared.ghost} ${shared.small} ${styles.back}`} aria-label="Back to dashboard">
                <Icon name="chevron-left" />
                Dashboard
            </Link>

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
                        <button type="button" className={`${shared.button} ${shared.secondary} ${shared.small}`} onClick={reload}>
                            Try again
                        </button>
                    )}
                </div>
            )}

            {state.status === 'ready' && <PathView path={state.path} onStatus={setStatus} />}
        </AppLayout>
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
    const [ params ] = useSearchParams();
    // Open the topic asked for, else where the user left off: the first topic with required items still to do.
    // Chosen once, so finishing a topic doesn't close it under the user.
    const [ firstOpen ] = useState( () => {
        const topics = path.modules.flatMap( ( module ) => module.topics );
        const asked = topics.find( ( topic ) => topic.id === params.get( 'topic' ) );

        return { id: ( asked ?? topics.find( isUnfinished ) )?.id, asked: asked !== undefined };
    } );

    useEffect( () => {
        if ( firstOpen.asked && firstOpen.id ) {
            document.getElementById( `topic-${firstOpen.id}` )?.scrollIntoView( { block: 'start' } );
        }
    }, [ firstOpen ] );

    return (
        <>
            <div className={styles.header}>
                <div className={styles.headTop}>
                    <div className={styles.titleRow}>
                        <h1 className={app.title}>{title}</h1>
                        {status && <span className={`${app.badge} ${path.status === EnrollmentStatus.Completed ? app.badgeSuccess : ''}`}>{status}</span>}
                    </div>
                    <Link to={`/app/paths/${path.id}/settings`} className={`${shared.button} ${shared.secondary}`}>
                        <Icon name="sliders" />
                        Path settings
                    </Link>
                </div>
                {description && <p className={app.muted}>{description}</p>}
                <ProgressBar label={`${title} progress`} percent={percent( completed, total )} />
                <p className={`${app.muted} ${app.small}`}>{`${completed} of ${total} items done · ${percent( completed, total )}%`}</p>
            </div>

            {path.modules.length === 0 && <p className={app.empty}>This path has no content yet.</p>}

            {path.modules.map( ( module ) => (
                <section key={module.id} className={app.card} aria-labelledby={`module-${module.id}`}>
                    <div className={styles.moduleHead}>
                        <div className={styles.moduleTitleRow}>
                            <h2 id={`module-${module.id}`} className={styles.moduleTitle}>{module.title}</h2>
                            <p className={`${app.mono} ${app.muted}`}>{`${module.progress.completed} of ${module.progress.total} done`}</p>
                        </div>
                        {module.description && <p className={`${app.muted} ${app.small}`}>{module.description}</p>}
                        <ProgressBar label={`${module.title} progress`} percent={percent( module.progress.completed, module.progress.total )} />
                    </div>
                    <div className={styles.topics}>
                        {module.topics.map( ( topic ) => (
                            <TopicSection
                                key={topic.id}
                                topic={topic}
                                enrollmentId={path.id}
                                initiallyOpen={topic.id === firstOpen.id}
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
        <details id={`topic-${topic.id}`} className={styles.topic} open={initiallyOpen}>
            <summary className={styles.topicSummary}>
                <h3 className={styles.topicTitle}>{topic.title}</h3>
                <span className={`${app.mono} ${total > 0 && completed === total ? styles.countDone : styles.count}`}>{`${completed}/${total}`}</span>
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
