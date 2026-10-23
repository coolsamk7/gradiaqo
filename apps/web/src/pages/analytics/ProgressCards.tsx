import type { AnalyticsJson } from '@studylog/schemas';
import { Difficulty as DifficultyLevel } from '@studylog/schemas/enums';

import { formatMinutes, percent } from '../../format/format.ts';
import app from '../../styles/app.module.css';
import styles from './Analytics.module.css';
import { doneShare, formatHours } from './analytics.ts';
import { Bar } from './TimeCharts.tsx';

const STATUSES = [
    { key: 'done', label: 'Done', color: 'var(--color-chart-2)' },
    { key: 'revise', label: 'Revise', color: 'var(--color-chart-1)' },
    { key: 'inProgress', label: 'In progress', color: 'var(--color-chart-3)' },
    { key: 'notStarted', label: 'Not started', color: 'var(--color-bg-muted)' },
] as const;

const RADIUS = 60;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Every item in the selected paths by status: a ring with the share done, and the counts. */
export function ItemStatus( { status }: { status: AnalyticsJson['itemStatus'] } ) {
    const total = STATUSES.reduce( ( sum, { key } ) => sum + status[key], 0 );
    let offset = 0;

    return (
        <section className={app.card} aria-labelledby="status-title">
            <div className={app.cardHeader}>
                <h2 id="status-title" className={app.cardTitle}>Item status</h2>
                <p className={`${app.muted} ${app.small}`}>{`${total} ${total === 1 ? 'item' : 'items'} you follow`}</p>
            </div>
            <div className={styles.statusBody}>
                <div className={styles.donut}>
                    <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
                        <circle cx="70" cy="70" r={RADIUS} fill="none" stroke="var(--color-bg-muted)" strokeWidth="20" />
                        {total > 0 && STATUSES.slice( 0, 3 ).map( ( { key, color } ) => {
                            const length = ( status[key] / total ) * CIRCUMFERENCE;
                            const segment = (
                                <circle
                                    key={key}
                                    cx="70"
                                    cy="70"
                                    r={RADIUS}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth="20"
                                    strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                                    strokeDashoffset={-offset}
                                    transform="rotate(-90 70 70)"
                                />
                            );

                            offset += length;

                            return status[key] > 0 ? segment : null;
                        } )}
                    </svg>
                    <p className={styles.donutCenter}>
                        <span className={styles.donutValue}>{`${doneShare( status )}%`}</span>
                        <span className={`${app.muted} ${app.small}`}>done</span>
                    </p>
                </div>
                <ul className={styles.legend}>
                    {STATUSES.map( ( { key, label, color } ) => (
                        <li key={key}>
                            <span className={styles.dot} style={{ background: color }} aria-hidden="true" />
                            <span className={styles.legendLabel}>{label}</span>
                            <span className={`${app.mono} ${app.muted}`}>{status[key]}</span>
                        </li>
                    ) )}
                </ul>
            </div>
        </section>
    );
}

const LEVELS = {
    [DifficultyLevel.Easy]: { label: 'Easy', color: 'var(--color-chart-2)' },
    [DifficultyLevel.Medium]: { label: 'Medium', color: 'var(--color-chart-3)' },
    [DifficultyLevel.Hard]: { label: 'Hard', color: 'var(--color-chart-4)' },
};

interface DifficultyProps {
    levels: AnalyticsJson['difficulty'];
    habits: AnalyticsJson['habits'];
}

/** Problems and exercises done at each difficulty, then the user's study habits in the period. */
export function Difficulty( { levels, habits }: DifficultyProps ) {
    const facts = [
        { label: 'Average session', value: habits.sessions > 0 ? formatMinutes( habits.averageSessionMinutes ) : '—' },
        { label: 'Best day', value: habits.bestWeekday ?? '—' },
        { label: 'Most active', value: habits.mostActiveHours ? formatHours( habits.mostActiveHours ) : '—' },
        { label: 'Sessions', value: String( habits.sessions ) },
    ];

    return (
        <section className={app.card} aria-labelledby="difficulty-title">
            <div className={app.cardHeader}>
                <h2 id="difficulty-title" className={app.cardTitle}>By difficulty</h2>
                <p className={`${app.muted} ${app.small}`}>Problems and exercises done</p>
            </div>
            {levels.length === 0 && <p className={`${app.muted} ${app.small}`}>No items with a difficulty in these paths.</p>}
            {levels.length > 0 && (
                <ul className={styles.levels}>
                    {levels.map( ( level ) => {
                        const share = percent( level.done, level.total );

                        return (
                            <li key={level.difficulty} className={styles.level}>
                                <span className={styles.levelName}>{LEVELS[level.difficulty].label}</span>
                                <Bar share={share} color={LEVELS[level.difficulty].color} thick />
                                <span className={`${app.mono} ${app.muted}`}>{`${level.done}/${level.total} · ${share}%`}</span>
                            </li>
                        );
                    } )}
                </ul>
            )}
            <dl className={styles.habits} aria-label="Study habits">
                {facts.map( ( fact ) => (
                    <div key={fact.label} className={styles.habit}>
                        <dt className={app.overline}>{fact.label}</dt>
                        <dd className={styles.habitValue}>{fact.value}</dd>
                    </div>
                ) )}
            </dl>
        </section>
    );
}
