import type { LearningPathJson, MyOrganizationJson } from '@studylog/schemas';
import { PathVisibility } from '@studylog/schemas/enums';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { AppLayout } from '../../components/AppLayout.tsx';
import { Icon } from '../../components/Icon.tsx';
import { relativeDay } from '../../format/format.ts';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import { LoadError, Loading } from './LoadStates.tsx';
import styles from './MyPaths.module.css';
import { NewPathDialog } from './NewPathDialog.tsx';
import { useMyPaths } from './use-my-paths.ts';

/** The paths the user builds (Figma: M4 · Build your own › My paths), in their workspace or an organization they run. */
export function MyPathsPage() {
    const [ params, setParams ] = useSearchParams();
    const { organizations, reloadOrganizations, editable, current, paths } = useMyPaths( params.get( 'org' ) ?? undefined );
    const [ creating, setCreating ] = useState( false );

    return (
        <AppLayout>
            <div className={app.header}>
                <div className={app.titleBlock}>
                    <h1 className={app.title}>My paths</h1>
                    <p className={app.muted}>
                        Paths you build from your own material and items from the catalog. Changes go live right away.
                    </p>
                </div>
                {current && (
                    <button type="button" className={`${shared.button} ${shared.primary}`} onClick={() => setCreating( true )}>
                        <Icon name="plus" />
                        New path
                    </button>
                )}
            </div>

            {organizations.status === 'loading' && <Loading text="Loading your paths…" />}
            {organizations.status === 'error' && <LoadError message={organizations.message} retry={reloadOrganizations} />}

            {current && (
                <>
                    {editable.length > 1 && (
                        <div className={styles.tabs} role="group" aria-label="Where">
                            {editable.map( ( organization ) => (
                                <button
                                    key={organization.id}
                                    type="button"
                                    className={styles.tab}
                                    aria-pressed={organization.id === current.id}
                                    onClick={() => setParams( { org: organization.id }, { replace: true } )}
                                >
                                    {placeName( organization )}
                                </button>
                            ) )}
                        </div>
                    )}

                    <p className={styles.info}>
                        <Icon name="info" />
                        {current.isPersonal
                            ? 'Public paths show up in everyone\'s catalog under Community. Private paths are only for you.'
                            : `Paths here are for the members of ${current.name}: they find them in Browse paths.`}
                    </p>

                    {paths.state.status === 'loading' && <Loading text="Loading your paths…" />}
                    {paths.state.status === 'error' && <LoadError message={paths.state.message} retry={paths.reload} />}
                    {paths.state.status === 'ready' && paths.state.value.length === 0 && (
                        <section className={`${app.card} ${styles.empty}`} aria-labelledby="empty-title">
                            <span className={styles.chip}><Icon name="layers" size={20} /></span>
                            <h2 id="empty-title" className={app.cardTitle}>No paths here yet</h2>
                            <p className={app.muted}>
                                Start one for the problems and notes you want to study, in the order you want.
                            </p>
                        </section>
                    )}
                    {paths.state.status === 'ready' && paths.state.value.length > 0 && (
                        <ul className={`${app.card} ${styles.list}`} aria-label={`Paths in ${placeName( current )}`}>
                            {paths.state.value.map( ( path ) => (
                                <PathRow key={path.id} path={path} organization={current} />
                            ) )}
                        </ul>
                    )}

                    {creating && <NewPathDialog organization={current} onClose={() => setCreating( false )} />}
                </>
            )}
        </AppLayout>
    );
}

/** "today", "yesterday" or "Wed, Aug 5". */
function updated( date: Date ): string {
    const day = relativeDay( date, new Date() );

    return day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : day;
}

function placeName( organization: MyOrganizationJson ): string {
    return organization.isPersonal ? 'Your workspace' : organization.name;
}

function PathRow( { path, organization }: { path: LearningPathJson; organization: MyOrganizationJson } ) {
    const isPublic = path.visibility === PathVisibility.Public;

    return (
        <li className={styles.row}>
            <span className={styles.chip}><Icon name="layers" /></span>
            <div className={styles.rowMain}>
                <h2 className={styles.rowTitle}>{path.title}</h2>
                <p className={`${app.muted} ${app.small}`}>{`Updated ${updated( new Date( path.updatedAt ) )}`}</p>
            </div>
            {organization.isPersonal && (
                <span className={`${app.badge} ${isPublic ? app.badgeSuccess : ''}`}>{isPublic ? 'Public' : 'Private'}</span>
            )}
            <Link
                to={`/app/my-paths/${organization.id}/${path.id}`}
                className={`${shared.button} ${shared.secondary} ${shared.small}`}
                aria-label={`Edit ${path.title}`}
            >
                <Icon name="edit" />
                Edit
            </Link>
        </li>
    );
}
