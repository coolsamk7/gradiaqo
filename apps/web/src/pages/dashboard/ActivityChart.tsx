import type { StudyStats } from '@studylog/schemas';

import styles from './Dashboard.module.css';
import { formatDays, formatMinutes, formatStatsDate } from './format.ts';

/** Minutes studied on each of the last 30 days, as bars. Oldest first; the last bar is today. */
export function ActivityChart( { days }: { days: StudyStats['last30Days'] } ) {
    const most = Math.max( 0, ...days.map( ( day ) => day.minutes ) );
    const total = days.reduce( ( sum, day ) => sum + day.minutes, 0 );
    const activeDays = days.filter( ( day ) => day.minutes > 0 ).length;
    const summary = total === 0
        ? 'No study time in the last 30 days yet.'
        : `${formatMinutes( total )} over ${formatDays( activeDays )}.`;

    return (
        <section className={styles.card} aria-labelledby="activity-title">
            <div className={styles.cardHeader}>
                <h2 id="activity-title" className={styles.cardTitle}>Last 30 days</h2>
                <p className={styles.muted}>{summary}</p>
            </div>
            <ol className={styles.chart} aria-label="Minutes studied per day">
                {days.map( ( day ) => {
                    const text = `${formatStatsDate( day.date )}: ${formatMinutes( day.minutes )}`;

                    return (
                        <li key={day.date} className={styles.chartDay} title={text}>
                            <span
                                className={day.minutes > 0 ? styles.chartBar : styles.chartBarEmpty}
                                style={day.minutes > 0 ? { height: `${( day.minutes / most ) * 100}%` } : undefined}
                            />
                            <span className="visually-hidden">{text}</span>
                        </li>
                    );
                } )}
            </ol>
            <div className={styles.chartAxis} aria-hidden="true">
                <span>30 days ago</span>
                <span>Today</span>
            </div>
        </section>
    );
}
