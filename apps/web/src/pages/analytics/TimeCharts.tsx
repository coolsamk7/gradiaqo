import type { AnalyticsJson, AnalyticsPeriod } from '@studylog/schemas';

import { formatMinutes } from '../../format/format.ts';
import app from '../../styles/app.module.css';
import styles from './Analytics.module.css';
import { labelledWeeks, periodLabel, weekLabel } from './analytics.ts';

/** Colors for paths, in order (Figma: chart-1, 2, 3 then 5; 4 is red and means "behind" elsewhere). */
const PATH_COLORS = [ 'var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-5)' ];

/** Study time per week as bars, oldest first; the current week is highlighted. */
export function WeeklyTime( { weeks }: { weeks: AnalyticsJson['weeks'] } ) {
    const most = Math.max( 0, ...weeks.map( ( week ) => week.minutes ) );
    const total = weeks.reduce( ( sum, week ) => sum + week.minutes, 0 );
    const labelled = labelledWeeks( weeks.length );

    return (
        <section className={app.card} aria-labelledby="weekly-title">
            <div className={app.cardHeader}>
                <h2 id="weekly-title" className={app.cardTitle}>Study time per week</h2>
                <p className={`${app.muted} ${app.small}`}>
                    {weeks.length > 0 ? `Average ${formatMinutes( Math.round( total / weeks.length ) )}` : 'No weeks yet'}
                </p>
            </div>
            <ol className={styles.weeks} aria-label="Minutes studied per week">
                {weeks.map( ( week, index ) => {
                    const text = `Week of ${weekLabel( week.weekStart )}: ${formatMinutes( week.minutes )}`;
                    const current = index === weeks.length - 1;

                    return (
                        <li key={week.weekStart} className={styles.week} title={text}>
                            <span className={styles.weekColumn}>
                                <span
                                    className={week.minutes > 0 ? `${styles.weekBar} ${current ? styles.current : ''}` : styles.weekBarEmpty}
                                    style={week.minutes > 0 ? { height: `${( week.minutes / most ) * 100}%` } : undefined}
                                />
                            </span>
                            <span className={styles.weekLabel} aria-hidden="true">
                                {labelled.has( index ) ? weekLabel( week.weekStart ) : ''}
                            </span>
                            <span className="visually-hidden">{text}</span>
                        </li>
                    );
                } )}
            </ol>
        </section>
    );
}

/** Study time per path in the period, as bars that show each path's share of the total. */
export function TimeByPath( { paths, period }: { paths: AnalyticsJson['byPath']; period: AnalyticsPeriod } ) {
    const total = paths.reduce( ( sum, path ) => sum + path.minutes, 0 );

    return (
        <section className={app.card} aria-labelledby="by-path-title">
            <div className={app.cardHeader}>
                <h2 id="by-path-title" className={app.cardTitle}>Where your time went</h2>
                <p className={`${app.muted} ${app.small}`}>{periodLabel( period )}</p>
            </div>
            {paths.length === 0 && <p className={`${app.muted} ${app.small}`}>No study time in this period yet.</p>}
            {paths.length > 0 && (
                <ul className={styles.bars}>
                    {paths.map( ( path, index ) => (
                        <li key={path.enrollmentId} className={styles.pathTime}>
                            <div className={styles.barLabel}>
                                <span>{path.title}</span>
                                <span className={`${app.mono} ${app.muted}`}>{formatMinutes( path.minutes )}</span>
                            </div>
                            <Bar
                                share={( path.minutes / total ) * 100}
                                color={PATH_COLORS[index % PATH_COLORS.length]}
                                thick
                            />
                        </li>
                    ) )}
                </ul>
            )}
        </section>
    );
}

/** A decorative track filled to `share` percent; the numbers next to it say the same in words. */
export function Bar( { share, color, thick = false }: { share: number; color: string; thick?: boolean } ) {
    return (
        <span className={`${styles.track} ${thick ? styles.thick : ''}`} aria-hidden="true">
            <span className={styles.fill} style={{ width: `${share}%`, background: color }} />
        </span>
    );
}
