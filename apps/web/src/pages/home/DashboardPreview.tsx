import { Icon } from '../../components/Icon.tsx';
import { percent } from '../../format/format.ts';
import { PREVIEW_PATHS, PREVIEW_STATS } from './content.tsx';
import styles from './DashboardPreview.module.css';

/**
 * An illustration of the dashboard (Figma: Home › Product preview), drawn with HTML and CSS rather than a screenshot
 * so it stays sharp and themed. Screen readers get a one-line summary instead of the parts.
 */
export function DashboardPreview() {
    return (
        <figure className={styles.preview}>
            <figcaption className="visually-hidden">
                {'Example dashboard: 1 hour 35 minutes studied today, a 12-day streak, '
                    + 'and Data Structures & Algorithms 60% complete.'}
            </figcaption>
            <div className={styles.window} aria-hidden="true">
                <p className={styles.greeting}>Good morning, Alice</p>
                <div className={styles.stats}>
                    {PREVIEW_STATS.map( ( stat ) => (
                        <div key={stat.label} className={styles.stat}>
                            <div className={styles.statHead}>
                                <span className={styles.label}>{stat.label}</span>
                                <span className={styles.chip}><Icon name={stat.icon} /></span>
                            </div>
                            <span className={styles.statValue}>{stat.value}</span>
                        </div>
                    ) )}
                </div>
                {PREVIEW_PATHS.map( ( path ) => (
                    <div key={path.title} className={styles.path}>
                        <div className={styles.pathHead}>
                            <span className={styles.pathTitle}>{path.title}</span>
                            <span className={styles.percent}>{`${percent( path.done, path.total )}%`}</span>
                        </div>
                        <div className={styles.track}>
                            <div className={styles.fill} style={{ width: `${percent( path.done, path.total )}%` }} />
                        </div>
                        <span className={styles.count}>{`${path.done} of ${path.total} items done`}</span>
                    </div>
                ) )}
            </div>
        </figure>
    );
}
