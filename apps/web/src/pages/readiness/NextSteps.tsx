import { EnrollmentStatus } from '@studylog/schemas/enums';
import { useState } from 'react';
import { Link } from 'react-router';

import { useAuth } from '../../auth/auth-context.ts';
import { Icon } from '../../components/Icon.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import { Badge } from './Badge.tsx';
import styles from './Readiness.module.css';
import type { NextStep } from './readiness.ts';
import { PRIORITIES, STEP_KINDS, stepLink } from './readiness.ts';

interface NextStepsProps {
    steps: NextStep[];
    /** After a step changed something (a path was resumed): load the readiness again. */
    onChanged: () => void;
}

/** Up to five things to do next, most important first, each with a button that does it or goes to it. */
export function NextSteps( { steps, onChanged }: NextStepsProps ) {
    return (
        <section className={app.card} aria-labelledby="steps-title">
            <div className={styles.stepsHeader}>
                <h2 id="steps-title" className={app.cardTitle}>Your next steps</h2>
                <p className={`${app.muted} ${app.small}`}>Picked from your paths, progress and sessions. Updated as you study.</p>
            </div>
            {steps.length === 0 && (
                <p className={app.empty}>Nothing to do right now: you&apos;ve covered everything in your goal.</p>
            )}
            {steps.length > 0 && (
                <ul className={styles.steps}>
                    {steps.map( ( step ) => <Step key={`${step.kind}-${step.enrollmentId}`} step={step} onChanged={onChanged} /> )}
                </ul>
            )}
        </section>
    );
}

function Step( { step, onChanged }: { step: NextStep; onChanged: () => void } ) {
    const { request } = useAuth();
    const [ resuming, setResuming ] = useState( false );
    const [ error, setError ] = useState<string>();
    const kind = STEP_KINDS[step.kind];
    const priority = PRIORITIES[step.priority];
    const button = `${shared.button} ${shared.secondary} ${shared.small}`;

    const resume = async () => {
        setResuming( true );
        setError( undefined );
        try {
            await request( `/me/enrollments/${step.enrollmentId}`, { method: 'PATCH', body: { status: EnrollmentStatus.Active } } );
            onChanged();
        } catch {
            setError( 'Couldn\'t resume this path. Please try again.' );
            setResuming( false );
        }
    };

    return (
        <li className={styles.step}>
            <span className={`${styles.stepChip} ${styles[priority.tone]}`}><Icon name={kind.icon} /></span>
            <div className={styles.stepCopy}>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={`${app.muted} ${app.small}`}>{step.detail}</p>
                {error && <p className={`${styles.danger} ${app.small}`} role="alert">{error}</p>}
            </div>
            <Badge tone={priority.tone}>{priority.label}</Badge>
            {step.kind === 'resume'
                ? (
                        <button type="button" className={button} disabled={resuming} onClick={() => void resume()}>
                            {resuming ? 'Resuming…' : kind.action}
                        </button>
                    )
                : <Link to={stepLink( step )} className={button} aria-label={`${kind.action}: ${step.title}`}>{kind.action}</Link>}
        </li>
    );
}
