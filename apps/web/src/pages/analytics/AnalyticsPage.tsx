import type { AnalyticsJson, AnalyticsPeriod } from '@studylog/schemas';
import { useSearchParams } from 'react-router';

import { AppLayout } from '../../components/AppLayout.tsx';
import { LoadError, Loading } from '../../components/LoadStates.tsx';
import { StatTiles } from '../../components/StatTiles.tsx';
import { formatMinutes } from '../../format/format.ts';
import form from '../../forms/form.module.css';
import app from '../../styles/app.module.css';
import styles from './Analytics.module.css';
import { isPeriod, PERIODS, versusBefore } from './analytics.ts';
import { AnalyticsSkeleton } from './AnalyticsSkeleton.tsx';
import { NeedsFocus } from './NeedsFocus.tsx';
import { Difficulty, ItemStatus } from './ProgressCards.tsx';
import { TimeByPath, WeeklyTime } from './TimeCharts.tsx';
import { useAnalytics, useFollowedPaths } from './use-analytics.ts';

/**
 * How the user studies and where to focus next (Figma: Insights › Analytics). The period and path filters live in
 * the URL (`?period=`, `?path=`), so they survive a reload and the back button.
 */
export function AnalyticsPage() {
    const [ params, setParams ] = useSearchParams();
    const periodParam = params.get( 'period' );
    const period: AnalyticsPeriod = isPeriod( periodParam ) ? periodParam : '30d';
    const enrollmentId = params.get( 'path' ) ?? undefined;
    const paths = useFollowedPaths();
    const { state, reload } = useAnalytics( period, enrollmentId );

    const choose = ( name: 'period' | 'path', value: string | undefined ) => setParams( ( current ) => {
        const next = new URLSearchParams( current );

        if ( value ) {
            next.set( name, value );
        } else {
            next.delete( name );
        }

        return next;
    } );

    return (
        <AppLayout>
            <div className={app.header}>
                <div className={app.titleBlock}>
                    <h1 className={app.title}>Analytics</h1>
                    <p className={app.muted}>How you study, and where to focus next.</p>
                </div>
                <div className={styles.actions}>
                    <label className={styles.pathFilter}>
                        <span className="visually-hidden">Path</span>
                        <select
                            className={form.input}
                            value={enrollmentId ?? ''}
                            onChange={( event ) => choose( 'path', event.target.value || undefined )}
                        >
                            <option value="">All paths</option>
                            {paths.map( ( path ) => (
                                <option key={path.id} value={path.id}>{path.learningPath.title}</option>
                            ) )}
                        </select>
                    </label>
                    <div className={styles.periods} role="group" aria-label="Period">
                        {PERIODS.map( ( option, index ) => (
                            <button
                                key={option.period}
                                type="button"
                                className={styles.period}
                                aria-pressed={option.period === period}
                                onClick={() => choose( 'period', index === 0 ? undefined : option.period )}
                            >
                                {option.label}
                            </button>
                        ) )}
                    </div>
                </div>
            </div>

            {state.status === 'loading' && (
                <Loading text="Loading your analytics…"><AnalyticsSkeleton /></Loading>
            )}

            {state.status === 'error' && <LoadError message={state.message} retry={reload} />}

            {state.status === 'ready' && (
                <>
                    <StatTiles tiles={tilesOf( state.data, enrollmentId ? 1 : paths.length )} />
                    <div className={styles.wideLeft}>
                        <WeeklyTime weeks={state.data.weeks} />
                        <TimeByPath paths={state.data.byPath} period={period} />
                    </div>
                    <div className={styles.wideRight}>
                        <ItemStatus status={state.data.itemStatus} />
                        <Difficulty levels={state.data.difficulty} habits={state.data.habits} />
                    </div>
                    <NeedsFocus topics={state.data.focus} today={state.data.to} />
                </>
            )}
        </AppLayout>
    );
}

/** The headline numbers for the period. `paths` is how many paths they cover. */
function tilesOf( data: AnalyticsJson, paths: number ) {
    const { totals, period } = data;

    return [
        { label: 'Time studied', value: formatMinutes( totals.minutes ), detail: versusBefore( totals, period ), icon: 'clock' as const },
        { label: 'Items done', value: String( totals.itemsDone ), detail: `${totals.itemsDoneTotal} in total`, icon: 'check-circle' as const },
        {
            label: 'Topics completed',
            value: `${totals.topicsCompleted} of ${totals.topicsTotal}`,
            detail: paths === 1 ? 'In this path' : `Across ${paths} paths`,
            icon: 'layers' as const,
        },
        { label: 'To revise', value: String( totals.toRevise ), detail: 'Items marked Revise', icon: 'flag' as const },
    ];
}
