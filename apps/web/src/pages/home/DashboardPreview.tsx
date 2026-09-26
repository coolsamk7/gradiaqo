import { DAYS, MAX_MINUTES, MODULES, PATH_PERCENT, WEEK } from './content.tsx';
import styles from './DashboardPreview.module.css';

/**
 * An illustration of the dashboard, drawn with HTML and CSS rather than a screenshot so it stays sharp and themed.
 * Screen readers get a one-line summary instead of the parts.
 */
export function DashboardPreview() {
    return (
        <figure className={styles.preview}>
            <figcaption className="visually-hidden">
                {`Example dashboard: Data Structures & Algorithms ${PATH_PERCENT}% complete, a 5-day streak and 45 minutes studied today.`}
            </figcaption>
            <div className={styles.window} aria-hidden="true">
                <div className={styles.titleBar}>
                    <span />
                    <span />
                    <span />
                </div>

                <div className={styles.body}>
                    <div className={styles.pathCard}>
                        <div className={styles.pathHeader}>
                            <div>
                                <p className={styles.label}>Learning path</p>
                                <p className={styles.pathTitle}>Data Structures & Algorithms</p>
                            </div>
                            <span className={styles.percent}>{`${PATH_PERCENT}%`}</span>
                        </div>
                        <div className={styles.track}>
                            <div className={styles.fill} style={{ width: `${PATH_PERCENT}%` }} />
                        </div>
                        <ul className={styles.modules}>
                            {MODULES.map( ( module ) => (
                                <li key={module.title} className={styles.module}>
                                    <span className={module.done === module.total ? styles.checkDone : styles.check} />
                                    <span className={styles.moduleTitle}>{module.title}</span>
                                    <span className={styles.count}>{`${module.done}/${module.total}`}</span>
                                </li>
                            ) )}
                        </ul>
                    </div>

                    <div className={styles.stats}>
                        <div className={styles.stat}>
                            <span className={styles.flame} />
                            <div>
                                <p className={styles.statValue}>5 days</p>
                                <p className={styles.label}>Streak</p>
                            </div>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.clock} />
                            <div>
                                <p className={styles.statValue}>45 min</p>
                                <p className={styles.label}>Today</p>
                            </div>
                        </div>
                    </div>

                    <div className={styles.chartCard}>
                        <p className={styles.label}>This week</p>
                        <div className={styles.chart}>
                            {WEEK.map( ( minutes, day ) => (
                                <div key={day} className={styles.barColumn}>
                                    <div className={styles.bar} style={{ height: `${Math.max( 6, ( minutes / MAX_MINUTES ) * 100 )}%` }} />
                                    <span className={styles.day}>{DAYS[day]}</span>
                                </div>
                            ) )}
                        </div>
                    </div>
                </div>
            </div>
        </figure>
    );
}
