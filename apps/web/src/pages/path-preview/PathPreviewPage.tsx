import type { EnrollmentDetailJson, EnrollmentRule, PublishedPathJson } from '@studylog/schemas';
import { PathVisibility } from '@studylog/schemas/enums';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { useAuth } from '../../auth/auth-context.ts';
import { AppLayout } from '../../components/AppLayout.tsx';
import { Icon } from '../../components/Icon.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import { authorOf, count, formatEstimate, sourceOf } from '../catalog/catalog-paths.ts';
import { TYPE_ICONS } from '../my-paths/builder-tree.ts';
import { ChoosePartsDialog } from './ChoosePartsDialog.tsx';
import { allTopics, rulesFor } from './parts.ts';
import styles from './PathPreview.module.css';
import { enrollError, formatMonth, itemLine, sourceName } from './preview.ts';
import { usePathPreview } from './use-path-preview.ts';

const BADGE_TONES = { accent: app.badgeAccent, neutral: '', inverse: app.badgeInverse, warning: app.badgeWarning };

/**
 * A path before enrolling (Figma: M1 › Path preview): its modules, topics and items, and the ways to follow it,
 * all of it or the parts the user picks. Paths they already follow link to their own view instead.
 */
export function PathPreviewPage() {
    const { pathId = '' } = useParams();
    const { state, reload } = usePathPreview( pathId );

    return (
        <AppLayout>
            <Link to="/app/catalog" className={`${shared.button} ${shared.ghost} ${shared.small} ${styles.back}`} aria-label="Back to Browse paths">
                <Icon name="chevron-left" />
                Browse paths
            </Link>

            {state.status === 'loading' && (
                <div className={app.status} role="status">
                    <span className={app.spinner} aria-hidden="true" />
                    Loading the path…
                </div>
            )}

            {state.status === 'error' && (
                <div className={app.error} role="alert">
                    <p>{state.message}</p>
                    {!state.notFound && (
                        <button type="button" className={`${shared.button} ${shared.secondary} ${shared.small}`} onClick={reload}>
                            Try again
                        </button>
                    )}
                </div>
            )}

            {state.status === 'ready' && <Preview path={state.path} />}
        </AppLayout>
    );
}

function Preview( { path }: { path: PublishedPathJson } ) {
    const { state: auth, request } = useAuth();
    const navigate = useNavigate();
    // Only rendered inside <RequireAuth>, so there is a session.
    const { user } = ( auth as Extract<typeof auth, { status: 'authenticated' }> ).session;
    const [ choosing, setChoosing ] = useState( false );
    const [ enrolling, setEnrolling ] = useState( false );
    const [ error, setError ] = useState<string>();
    const source = sourceOf( path, user.id );
    const estimate = formatEstimate( path.contents.estimatedMinutes );
    // Open the first topic, so there's something to look at.
    const firstTopic = path.modules.flatMap( ( module ) => module.topics )[0]?.id;

    /** Enrolls and opens the new enrollment; resolves with an error message if that failed. */
    const enroll = async ( rules: EnrollmentRule[] = [] ): Promise<string | undefined> => {
        try {
            const enrollment = await request<EnrollmentDetailJson>( '/me/enrollments', {
                method: 'POST',
                body: { learningPathId: path.id, ...( rules.length > 0 ? { rules } : {} ) },
            } );

            void navigate( `/app/paths/${enrollment.id}` );

            return undefined;
        } catch ( failure ) {
            return enrollError( failure );
        }
    };

    const enrollWhole = async () => {
        setEnrolling( true );
        setError( undefined );
        const failed = await enroll();

        if ( failed ) {
            setError( failed );
            setEnrolling( false );
        }
    };

    const actions = path.enrollmentId
        ? (
                <Link to={`/app/paths/${path.enrollmentId}`} className={`${shared.button} ${shared.primary}`}>
                    Continue
                    <Icon name="arrow-right" />
                </Link>
            )
        : (
                <>
                    <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={() => setChoosing( true )}>
                        Choose parts
                    </button>
                    <button type="button" className={`${shared.button} ${shared.accent}`} disabled={enrolling} onClick={() => void enrollWhole()}>
                        <Icon name="plus" />
                        {enrolling ? 'Enrolling…' : 'Enroll'}
                    </button>
                </>
            );

    return (
        <>
            <div className={app.header}>
                <div className={styles.titleBlock}>
                    <div className={styles.badges}>
                        <span className={`${app.badge} ${BADGE_TONES[source.tone]}`}>{source.label}</span>
                        {path.enrollmentId && <span className={`${app.badge} ${app.badgeSuccess}`}>Enrolled</span>}
                    </div>
                    <h1 className={app.title}>{path.title}</h1>
                    {path.description && <p className={app.muted}>{path.description}</p>}
                    <ul className={styles.meta} aria-label="Contents">
                        <li>
                            <Icon name="layers" />
                            {count( path.contents.modules, 'module' )}
                        </li>
                        <li>
                            <Icon name="file-text" />
                            {count( path.contents.items, 'item' )}
                        </li>
                        {estimate && (
                            <li>
                                <Icon name="clock" />
                                {estimate}
                            </li>
                        )}
                        <li>
                            <Icon name="user" />
                            {authorOf( path, user.id )}
                        </li>
                    </ul>
                </div>
                <div className={styles.actions}>{actions}</div>
            </div>

            {error && <p className={app.error} role="alert">{error}</p>}

            <div className={styles.columns}>
                <div className={styles.contents}>
                    {path.modules.length === 0 && <p className={`${app.card} ${app.empty}`}>This path has no content yet.</p>}
                    {path.modules.map( ( module ) => (
                        <section key={module.id} className={`${app.card} ${styles.module}`} aria-labelledby={`module-${module.id}`}>
                            <div className={styles.moduleHead}>
                                <h2 id={`module-${module.id}`} className={app.cardTitle}>{module.title}</h2>
                                <span className={`${app.muted} ${app.small}`}>{count( module.topics.length, 'topic' )}</span>
                            </div>
                            {module.topics.map( ( topic ) => (
                                <details key={topic.id} className={styles.topic} open={topic.id === firstTopic}>
                                    <summary className={styles.topicSummary}>
                                        <Icon name="chevron-right" className={styles.chevron} />
                                        <h3 className={styles.topicTitle}>{topic.title}</h3>
                                        <span className={`${app.muted} ${app.small}`}>{count( topic.items.length, 'item' )}</span>
                                    </summary>
                                    {topic.items.length === 0 && (
                                        <p className={styles.noItems}>No items in this topic yet.</p>
                                    )}
                                    {topic.items.length > 0 && (
                                        <ul className={styles.items}>
                                            {topic.items.map( ( item ) => (
                                                <li key={item.id} className={styles.item}>
                                                    <Icon name={TYPE_ICONS[item.type]} className={styles.itemIcon} />
                                                    <span className={styles.itemTitle}>{item.title}</span>
                                                    <span className={`${app.muted} ${app.small}`}>{itemLine( item )}</span>
                                                </li>
                                            ) )}
                                        </ul>
                                    )}
                                </details>
                            ) )}
                        </section>
                    ) )}
                </div>

                <div className={styles.side}>
                    <section className={`${app.card} ${styles.follow}`} aria-labelledby="follow-title">
                        <div className={styles.cardHead}>
                            <h2 id="follow-title" className={app.cardTitle}>{path.enrollmentId ? 'You follow this path' : 'Follow this path'}</h2>
                            <p className={`${app.muted} ${app.small}`}>
                                {path.enrollmentId
                                    ? 'Pick up where you left off, or change what you follow in Path settings.'
                                    : 'Follow all of it, or choose only the modules and topics you need. You can change this later in Path settings.'}
                            </p>
                        </div>
                        {path.enrollmentId
                            ? (
                                    <>
                                        <Link to={`/app/paths/${path.enrollmentId}`} className={`${shared.button} ${shared.primary}`}>Continue</Link>
                                        <Link to={`/app/paths/${path.enrollmentId}/settings`} className={`${shared.button} ${shared.secondary}`}>
                                            Path settings
                                        </Link>
                                    </>
                                )
                            : (
                                    <>
                                        <button type="button" className={`${shared.button} ${shared.accent}`} disabled={enrolling} onClick={() => void enrollWhole()}>
                                            <Icon name="plus" />
                                            {enrolling ? 'Enrolling…' : 'Enroll'}
                                        </button>
                                        <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={() => setChoosing( true )}>
                                            Choose parts
                                        </button>
                                    </>
                                )}
                    </section>
                    <section className={app.card} aria-labelledby="about-title">
                        <h2 id="about-title" className={`${app.cardTitle} ${styles.aboutTitle}`}>About</h2>
                        <dl className={styles.about}>
                            <div>
                                <dt>Source</dt>
                                <dd>{sourceName( path, user.id )}</dd>
                            </div>
                            <div>
                                <dt>Updated</dt>
                                <dd>{formatMonth( path.updatedAt )}</dd>
                            </div>
                            <div>
                                <dt>Visibility</dt>
                                <dd>{path.visibility === PathVisibility.Public ? 'Public' : 'Private'}</dd>
                            </div>
                        </dl>
                    </section>
                </div>
            </div>

            {choosing && (
                <ChoosePartsDialog
                    modules={path.modules}
                    initial={allTopics( path.modules )}
                    confirm="Enroll"
                    onConfirm={( ticked ) => enroll( rulesFor( path.modules, ticked ) )}
                    onClose={() => setChoosing( false )}
                />
            )}
        </>
    );
}
