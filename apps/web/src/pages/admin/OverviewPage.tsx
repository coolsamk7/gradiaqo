import type { PlatformOverviewJson } from '@studylog/schemas';
import { Link } from 'react-router';

import { useLoaded } from '../../api/use-loaded.ts';
import { AppLayout } from '../../components/AppLayout.tsx';
import { CardSkeleton, LoadError, Loading } from '../../components/LoadStates.tsx';
import { StatTiles } from '../../components/StatTiles.tsx';
import { formatStatsDate } from '../../format/format.ts';
import app from '../../styles/app.module.css';
import styles from './Admin.module.css';
import { AdminNav } from './AdminNav.tsx';
import { loadError } from './catalog.ts';
import { overviewTiles, signupSummary } from './overview.ts';

/**
 * The Admin landing page, for superadmins: accounts and how many are active, sign-ups per day, study over the last
 * 30 days, and the paths with the most learners.
 */
export function OverviewPage() {
    const overview = useLoaded<PlatformOverviewJson>( '/admin/overview', loadError );

    return (
        <AppLayout>
            <div className={app.header}>
                <div className={app.titleBlock}>
                    <div className={styles.titleRow}>
                        <h1 className={app.title}>Overview</h1>
                        <span className={`${app.badge} ${app.badgeInverse}`}>Admin</span>
                    </div>
                    <p className={app.muted}>The platform over the last 30 days. Days are in UTC.</p>
                </div>
            </div>
            <AdminNav />

            {overview.state.status === 'loading' && <Loading text="Loading the overview…"><CardSkeleton lines={4} /></Loading>}
            {overview.state.status === 'error' && <LoadError message={overview.state.message} retry={overview.reload} />}
            {overview.state.status === 'ready' && (
                <>
                    <StatTiles tiles={overviewTiles( overview.state.value )} />
                    <div className={styles.overviewRow}>
                        <SignupsChart days={overview.state.value.signups.perDay} />
                        <TopPaths paths={overview.state.value.topPaths} />
                    </div>
                </>
            )}
        </AppLayout>
    );
}

/** New accounts on each of the last 30 days, as bars. Oldest first; the last bar is today. */
function SignupsChart( { days }: { days: PlatformOverviewJson['signups']['perDay'] } ) {
    const most = Math.max( 0, ...days.map( ( day ) => day.count ) );

    return (
        <section className={app.card} aria-labelledby="signups-title">
            <div className={styles.chartHeader}>
                <h2 id="signups-title" className={app.cardTitle}>Sign-ups per day</h2>
                <p className={`${app.muted} ${app.small}`}>{signupSummary( days )}</p>
            </div>
            <ol className={styles.chart} aria-label="Sign-ups per day">
                {days.map( ( day ) => {
                    const text = `${formatStatsDate( day.date )}: ${day.count}`;

                    return (
                        <li key={day.date} className={styles.chartDay} title={text}>
                            <span
                                className={day.count > 0 ? styles.chartBar : styles.chartBarEmpty}
                                style={day.count > 0 ? { height: `${( day.count / most ) * 100}%` } : undefined}
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

/** The paths with the most enrollments, official or shared by users. */
function TopPaths( { paths }: { paths: PlatformOverviewJson['topPaths'] } ) {
    return (
        <section className={app.card} aria-labelledby="top-paths-title">
            <h2 id="top-paths-title" className={`${app.cardTitle} ${styles.resolvedTitle}`}>Most followed paths</h2>
            {paths.length === 0
                ? <p className={`${app.muted} ${app.small}`}>Nobody has enrolled in a path yet.</p>
                : (
                        <ol className={styles.rows}>
                            {paths.map( ( path ) => (
                                <li key={path.id} className={styles.row}>
                                    <div className={styles.copy}>
                                        <Link to={`/app/catalog/${path.id}`} className={`${styles.strong} ${styles.pathLink}`}>{path.title}</Link>
                                    </div>
                                    <span className={`${app.badge} ${path.official ? app.badgeAccent : app.badgeWarning}`}>
                                        {path.official ? 'Official' : 'Community'}
                                    </span>
                                    <span className={`${app.muted} ${app.small}`}>
                                        {`${path.enrollments} ${path.enrollments === 1 ? 'learner' : 'learners'}`}
                                    </span>
                                </li>
                            ) )}
                        </ol>
                    )}
        </section>
    );
}
