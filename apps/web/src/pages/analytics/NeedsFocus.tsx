import type { AnalyticsJson } from '@studylog/schemas';
import { Link } from 'react-router';

import { Icon } from '../../components/Icon.tsx';
import { percent } from '../../format/format.ts';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Analytics.module.css';
import { focusSummary, toneOf } from './analytics.ts';
import { Bar } from './TimeCharts.tsx';

const TONES = {
    danger: { text: styles.danger, bar: 'var(--color-chart-4)' },
    warning: { text: styles.warning, bar: 'var(--color-chart-3)' },
    success: { text: styles.success, bar: 'var(--color-chart-2)' },
};

/** Unfinished topics that need attention, each with what to do next and a link to it in the path. */
export function NeedsFocus( { topics, today }: { topics: AnalyticsJson['focus']; today: string } ) {
    return (
        <section className={app.card} aria-labelledby="focus-title">
            <div className={styles.focusHeader}>
                <h2 id="focus-title" className={app.cardTitle}>Needs focus</h2>
                <p className={`${app.muted} ${app.small}`}>Topics with little progress, items waiting for revision, or no study in a while.</p>
            </div>
            {topics.length === 0 && <p className={app.empty}>Nothing needs attention right now. Nice work.</p>}
            {topics.length > 0 && (
                <ul className={styles.focusGrid}>
                    {topics.map( ( topic ) => {
                        const share = percent( topic.completed, topic.total );
                        const tone = TONES[toneOf( share )];
                        const next = topic.next[0];

                        return (
                            <li key={topic.topicId} className={styles.focus}>
                                <div className={styles.focusTop}>
                                    <div className={styles.focusTitles}>
                                        <h3 className={styles.focusTitle}>{topic.topicTitle}</h3>
                                        <p className={`${app.muted} ${app.small}`}>{`${topic.pathTitle} · ${topic.moduleTitle}`}</p>
                                    </div>
                                    <span className={`${app.mono} ${tone.text}`}>{`${share}%`}</span>
                                </div>
                                <Bar share={share} color={tone.bar} />
                                <p className={`${app.muted} ${app.small}`}>{focusSummary( topic, today )}</p>
                                <div className={styles.focusNext}>
                                    <p className={styles.nextItem}>{next ? `Next: ${next.title}` : 'Nothing left to start'}</p>
                                    <Link
                                        to={`/app/paths/${topic.enrollmentId}?topic=${topic.topicId}`}
                                        className={`${shared.button} ${shared.ghost} ${shared.small}`}
                                        aria-label={`Open ${topic.topicTitle}`}
                                    >
                                        <Icon name="arrow-right" />
                                        Open topic
                                    </Link>
                                </div>
                            </li>
                        );
                    } )}
                </ul>
            )}
        </section>
    );
}
