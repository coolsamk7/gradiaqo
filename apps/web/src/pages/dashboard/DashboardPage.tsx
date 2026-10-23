import type { EnrollmentJson } from '@studylog/schemas';
import { EnrollmentStatus } from '@studylog/schemas/enums';
import { Link } from 'react-router';

import { useAuth } from '../../auth/auth-context.ts';
import { AppLayout } from '../../components/AppLayout.tsx';
import { Icon } from '../../components/Icon.tsx';
import { formatLongDate, formatMinutes, greeting } from '../../format/format.ts';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import { ActivityChart } from './ActivityChart.tsx';
import styles from './Dashboard.module.css';
import { DashboardSkeleton } from './DashboardSkeleton.tsx';
import { PathList } from './PathList.tsx';
import { RecentSessions } from './RecentSessions.tsx';
import { StatTiles } from './StatTiles.tsx';
import type { DashboardState } from './use-dashboard.ts';
import { useDashboard } from './use-dashboard.ts';

/** Where users land after logging in: their study time, streak, learning paths and latest sessions. */
export function DashboardPage() {
    const { state: auth } = useAuth();
    const { state, reload, setEnrollments } = useDashboard();
    // Only rendered inside <RequireAuth>, so there is a session.
    const { user } = ( auth as Extract<typeof auth, { status: 'authenticated' }> ).session;
    const now = new Date();

    return (
        <AppLayout>
            <div className={app.header}>
                <div className={app.titleBlock}>
                    <p className={app.overline}>{formatLongDate( now )}</p>
                    <h1 className={app.title}>{`${greeting( now )}, ${user.firstName}`}</h1>
                    <p className={app.muted}>{summaryOf( state )}</p>
                </div>
                <Link to="/app/sessions?log" className={`${shared.button} ${shared.primary}`}>
                    <Icon name="plus" />
                    Log session
                </Link>
            </div>

            {state.status === 'loading' && (
                <>
                    <div className={app.status} role="status">
                        <span className={app.spinner} aria-hidden="true" />
                        Loading your dashboard…
                    </div>
                    <DashboardSkeleton />
                </>
            )}

            {state.status === 'error' && (
                <div className={app.error} role="alert">
                    <p>{state.message}</p>
                    <button type="button" className={`${shared.button} ${shared.secondary} ${shared.small}`} onClick={reload}>
                        Try again
                    </button>
                </div>
            )}

            {state.status === 'ready' && (
                <>
                    <StatTiles stats={state.data.stats} paths={following( state.data.enrollments ).length} />
                    <div className={styles.columns}>
                        <PathList enrollments={state.data.enrollments} onReordered={setEnrollments} />
                        <div className={styles.side}>
                            <ActivityChart days={state.data.stats.last30Days} />
                            <RecentSessions sessions={state.data.sessions} now={now} />
                        </div>
                    </div>
                </>
            )}
        </AppLayout>
    );
}

/** Paths the user still follows (dropped ones aren't shown). */
function following( enrollments: EnrollmentJson[] ): EnrollmentJson[] {
    return enrollments.filter( ( enrollment ) => enrollment.status !== EnrollmentStatus.Dropped );
}

/** The line under the greeting: how the week is going, or how to start. */
function summaryOf( state: DashboardState ): string {
    if ( state.status !== 'ready' ) {
        return 'Here\'s how your studying is going.';
    }
    if ( following( state.data.enrollments ).length === 0 ) {
        return 'Welcome to StudyLog. Pick a learning path to get started.';
    }

    const week = state.data.stats.weekMinutes;

    return week > 0
        ? `You've studied ${formatMinutes( week )} this week. Keep the streak going.`
        : 'Nothing logged this week yet. A short session keeps the streak going.';
}
