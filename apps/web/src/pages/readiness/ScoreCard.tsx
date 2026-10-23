import type { EnrollmentJson, InterviewGoalJson } from '@studylog/schemas';

import { Icon } from '../../components/Icon.tsx';
import { formatStatsDate } from '../../format/format.ts';
import app from '../../styles/app.module.css';
import { Badge } from './Badge.tsx';
import styles from './Readiness.module.css';
import type { Readiness } from './readiness.ts';
import { factsOf, goalPathTitles, LABEL_TONES, summaryOf } from './readiness.ts';

const RADIUS = 64;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface ScoreCardProps {
    goal: InterviewGoalJson;
    readiness: Readiness;
    paths: EnrollmentJson[];
}

/** The score in a ring, the goal with its label, a summary, and time left, pace and projection. */
export function ScoreCard( { goal, readiness, paths }: ScoreCardProps ) {
    const filled = ( readiness.score / 100 ) * CIRCUMFERENCE;

    return (
        <section className={`${app.card} ${styles.score}`} aria-labelledby="goal-heading">
            <div
                className={styles.ring}
                role="img"
                aria-label={`Readiness score: ${readiness.score} of 100`}
            >
                <svg width="148" height="148" viewBox="0 0 148 148" aria-hidden="true">
                    <circle cx="74" cy="74" r={RADIUS} fill="none" stroke="var(--color-bg-muted)" strokeWidth="16" />
                    {readiness.score > 0 && (
                        <circle
                            cx="74"
                            cy="74"
                            r={RADIUS}
                            fill="none"
                            stroke="var(--color-accent)"
                            strokeWidth="16"
                            strokeDasharray={`${filled} ${CIRCUMFERENCE - filled}`}
                            transform="rotate(-90 74 74)"
                        />
                    )}
                </svg>
                <span className={styles.ringCenter} aria-hidden="true">
                    <span className={styles.ringValue}>{readiness.score}</span>
                    <span className={`${app.muted} ${app.small}`}>of 100</span>
                </span>
            </div>
            <div className={styles.summary}>
                <div className={styles.goalTitle}>
                    <h2 id="goal-heading" className={styles.goalName}>{`${goal.title} · ${formatStatsDate( goal.targetDate )}`}</h2>
                    <Badge tone={LABEL_TONES[readiness.label]}>{readiness.label}</Badge>
                </div>
                <p className={app.muted}>{summaryOf( readiness, goalPathTitles( goal.enrollmentIds, paths ) )}</p>
                <dl className={styles.facts}>
                    {factsOf( readiness ).map( ( fact ) => (
                        <div key={fact.label} className={styles.fact}>
                            <Icon name={fact.icon} className={styles.factIcon} />
                            <div>
                                <dt className={app.overline}>{fact.label}</dt>
                                <dd className={`${styles.factValue} ${fact.tone ? styles[fact.tone] : ''}`}>{fact.value}</dd>
                            </div>
                        </div>
                    ) )}
                </dl>
            </div>
        </section>
    );
}
