import { useState } from 'react';

import { AppLayout } from '../../components/AppLayout.tsx';
import { Icon } from '../../components/Icon.tsx';
import { CardSkeleton, LoadError, Loading } from '../../components/LoadStates.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import { Categories } from './Categories.tsx';
import { GoalDialog } from './GoalDialog.tsx';
import { NextSteps } from './NextSteps.tsx';
import styles from './Readiness.module.css';
import { weightsOf } from './readiness.ts';
import { ScoreCard } from './ScoreCard.tsx';
import { useReadiness } from './use-readiness.ts';

/**
 * How ready the user is for their interview goal (Figma: Insights › Interview ready): a score, a card per category
 * with its checks, and the next steps. Without a goal, it asks for one.
 */
export function ReadinessPage() {
    const { state, reload } = useReadiness();
    const [ editing, setEditing ] = useState( false );
    const data = state.status === 'ready' ? state.data : undefined;
    const goal = data?.readiness.goal;

    const onSaved = () => {
        setEditing( false );
        reload();
    };

    return (
        <AppLayout>
            <div className={app.header}>
                <div className={app.titleBlock}>
                    <h1 className={app.title}>Interview ready</h1>
                    <p className={app.muted}>How prepared you are for your goal, and what to do next.</p>
                </div>
                {goal && (
                    <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={() => setEditing( true )}>
                        <Icon name="edit" />
                        Edit goal
                    </button>
                )}
            </div>

            {state.status === 'loading' && (
                <Loading text="Loading your readiness…">
                    <CardSkeleton lines={4} />
                    <CardSkeleton />
                    <CardSkeleton />
                </Loading>
            )}

            {state.status === 'error' && <LoadError message={state.message} retry={reload} />}

            {data && !data.readiness.readiness && (
                <section className={`${app.card} ${styles.empty}`} aria-labelledby="no-goal-title">
                    <span className={styles.emptyChip}><Icon name="target" /></span>
                    <h2 id="no-goal-title" className={app.cardTitle}>Set an interview goal</h2>
                    <p className={app.muted}>
                        Pick a date and the paths that matter. StudyLog then tracks how ready you are and tells you what
                        to do next.
                    </p>
                    {data.paths.length > 0
                        ? (
                                <button type="button" className={`${shared.button} ${shared.accent}`} onClick={() => setEditing( true )}>
                                    Set a goal
                                </button>
                            )
                        : <p className={`${app.muted} ${app.small}`}>First follow a learning path from Browse paths.</p>}
                </section>
            )}

            {data?.readiness.goal && data.readiness.readiness && (
                <>
                    <ScoreCard goal={data.readiness.goal} readiness={data.readiness.readiness} paths={data.paths} />
                    <Categories categories={data.readiness.readiness.categories} />
                    <NextSteps steps={data.readiness.readiness.nextSteps} onChanged={reload} />
                    <p className={styles.footnote}>
                        <Icon name="info" />
                        {`How the score works: ${weightsOf( data.readiness.readiness.weights )}. Only the paths in your goal count.`}
                    </p>
                </>
            )}

            {editing && data && (
                <GoalDialog
                    goal={data.readiness.goal}
                    paths={data.paths}
                    onClose={() => setEditing( false )}
                    onSaved={onSaved}
                />
            )}
        </AppLayout>
    );
}
