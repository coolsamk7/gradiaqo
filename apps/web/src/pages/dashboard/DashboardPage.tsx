import { Link } from 'react-router';

import { useAuth } from '../../auth/auth-context.ts';
import { AppHeader } from '../../components/AppHeader.tsx';
import { greeting } from '../../format/format.ts';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import { ActivityChart } from './ActivityChart.tsx';
import styles from './Dashboard.module.css';
import { PathList } from './PathList.tsx';
import { RecentSessions } from './RecentSessions.tsx';
import { StatTiles } from './StatTiles.tsx';
import { useDashboard } from './use-dashboard.ts';

/** Where users land after logging in: their study time, streak, learning paths and latest sessions. */
export function DashboardPage() {
    const { state: auth } = useAuth();
    const { state, reload } = useDashboard();
    // Only rendered inside <RequireAuth>, so there is a session.
    const { user } = ( auth as Extract<typeof auth, { status: 'authenticated' }> ).session;
    const now = new Date();

    return (
        <div className={app.page}>
            <AppHeader />
            <main className={`${shared.container} ${app.main}`}>
                <div className={styles.intro}>
                    <div>
                        <h1 className={app.title}>{`${greeting( now )}, ${user.firstName}!`}</h1>
                        <p className={app.muted}>Here&apos;s how your studying is going.</p>
                    </div>
                    <Link to="/app/sessions?log" className={`${shared.button} ${shared.primary}`}>Log session</Link>
                </div>

                {state.status === 'loading' && (
                    <div className={app.status} role="status">
                        <span className={app.spinner} aria-hidden="true" />
                        Loading your dashboard…
                    </div>
                )}

                {state.status === 'error' && (
                    <div className={app.error} role="alert">
                        <p>{state.message}</p>
                        <button type="button" className={`${shared.button} ${shared.secondary} ${app.retry}`} onClick={reload}>
                            Try again
                        </button>
                    </div>
                )}

                {state.status === 'ready' && (
                    <>
                        <StatTiles stats={state.data.stats} />
                        <div className={styles.columns}>
                            <PathList enrollments={state.data.enrollments} />
                            <div className={styles.side}>
                                <ActivityChart days={state.data.stats.last30Days} />
                                <RecentSessions sessions={state.data.sessions} now={now} />
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
