import type { LearningPathTreeJson, MyOrganizationJson } from '@studylog/schemas';
import { CatalogStatus, PathVisibility } from '@studylog/schemas/enums';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { useAuth } from '../../auth/auth-context.ts';
import { AppLayout } from '../../components/AppLayout.tsx';
import { Icon } from '../../components/Icon.tsx';
import { CardSkeleton, LoadError, Loading } from '../../components/LoadStates.tsx';
import { StatusBadge } from '../../components/StatusBadge.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Builder.module.css';
import type { Selection } from './builder-tree.ts';
import { resolveSelection } from './builder-tree.ts';
import { NodeEditor } from './NodeEditor.tsx';
import { saveErrorMessage } from './problems.ts';
import { StructureCard } from './StructureCard.tsx';
import { TopicItems } from './TopicItems.tsx';
import type { Send } from './use-path-builder.ts';
import { catalogBase, usePathBuilder } from './use-path-builder.ts';

/**
 * Builds a path (Figma: M4 · Build your own › Path builder): its modules and topics on the left, the chosen one on
 * the right with, for a topic, its items. Every change is saved right away. With `global`, a path of the global
 * catalog (superadmins): parts start as drafts, so their status can be changed too.
 */
export function PathBuilderPage( { global = false }: { global?: boolean } ) {
    const { organizationId = '', pathId = '' } = useParams();
    const { state, reload, send } = usePathBuilder( global ? { kind: 'global' } : { kind: 'organization', organizationId }, pathId );

    return (
        <AppLayout>
            <Link
                to={global ? '/app/admin/catalog' : `/app/my-paths?org=${organizationId}`}
                className={`${shared.button} ${shared.ghost} ${shared.small} ${styles.back}`}
                aria-label={global ? 'Back to the global catalog' : 'Back to my paths'}
            >
                <Icon name="chevron-left" />
                {global ? 'Global catalog' : 'My paths'}
            </Link>

            {state.status === 'loading' && <Loading text="Loading the path…"><CardSkeleton lines={5} /></Loading>}
            {state.status === 'error' && <LoadError message={state.message} retry={reload} />}
            {state.status === 'ready' && <Builder path={state.path} organization={state.organization} send={send} />}
        </AppLayout>
    );
}

interface BuilderProps {
    path: LearningPathTreeJson;
    /** Null in the global catalog. */
    organization: MyOrganizationJson | null;
    send: Send;
}

function Builder( { path, organization, send }: BuilderProps ) {
    const [ selection, setSelection ] = useState<Selection>();
    const selected = resolveSelection( path, selection );

    return (
        <>
            <PathHeader path={path} organization={organization} send={send} onEdit={() => setSelection( { kind: 'path' } )} />
            <div className={styles.columns}>
                <StructureCard path={path} selected={selected} onSelect={setSelection} send={send} />
                <div className={styles.side}>
                    <NodeEditor
                        key={nodeKey( selected )}
                        selected={selected}
                        path={path}
                        send={send}
                        withStatus={organization === null}
                    />
                    {selected.kind === 'topic' && (
                        <TopicItems key={`items-${selected.topic.id}`} topic={selected.topic} send={send} />
                    )}
                </div>
            </div>
        </>
    );
}

function nodeKey( selected: ReturnType<typeof resolveSelection> ): string {
    if ( selected.kind === 'path' ) {
        return 'path';
    }

    return selected.kind === 'module' ? selected.module.id : selected.topic.id;
}

function PathHeader( { path, organization, send, onEdit }: BuilderProps & { onEdit: () => void } ) {
    const { request } = useAuth();
    const navigate = useNavigate();
    const [ confirming, setConfirming ] = useState( false );
    const [ busy, setBusy ] = useState( false );
    const [ error, setError ] = useState<string>();
    const isPublic = path.visibility === PathVisibility.Public;
    // A moderator took it out of the public catalog: it can't be made public again.
    const canPublish = organization?.isPersonal === true && ( isPublic || path.publicBlockedAt === null );
    // In the global catalog only drafts can be deleted.
    const canDelete = organization !== null || path.status === CatalogStatus.Draft;
    const home = organization ? `/app/my-paths?org=${organization.id}` : '/app/admin/catalog';

    const run = async ( change: () => Promise<unknown> ) => {
        setBusy( true );
        setError( undefined );
        try {
            await change();
        } catch ( caught ) {
            setError( saveErrorMessage( caught ) );
        }
        setBusy( false );
    };

    const toggleVisibility = () => run( () => send( `/paths/${path.id}`, {
        method: 'PATCH',
        body: { visibility: isPublic ? PathVisibility.Private : PathVisibility.Public },
    } ) );

    const remove = () => run( async () => {
        const scope = organization ? { kind: 'organization' as const, organizationId: organization.id } : { kind: 'global' as const };

        await request( `${catalogBase( scope )}/paths/${path.id}`, { method: 'DELETE' } );
        void navigate( home );
    } );

    return (
        <div className={styles.header}>
            <div className={app.titleBlock}>
                <div className={styles.titleRow}>
                    <h1 className={app.title}>{path.title}</h1>
                    {!organization && <StatusBadge status={path.status} />}
                    {organization?.isPersonal && (
                        <span className={`${app.badge} ${isPublic ? app.badgeSuccess : ''}`}>{isPublic ? 'Public' : 'Private'}</span>
                    )}
                </div>
                <p className={app.muted}>
                    {subtitle( path, organization )}
                </p>
            </div>

            {confirming
                ? (
                        <div className={styles.confirm} role="group" aria-label="Delete this path?">
                            <span>Delete this path? Its modules and topics go too; your items stay.</span>
                            <button type="button" className={`${shared.button} ${shared.danger} ${shared.small}`} disabled={busy} onClick={() => void remove()}>
                                Delete
                            </button>
                            <button type="button" className={`${shared.button} ${shared.secondary} ${shared.small}`} onClick={() => setConfirming( false )}>
                                Cancel
                            </button>
                        </div>
                    )
                : (
                        <div className={styles.headerActions}>
                            {canPublish && (
                                <label className={styles.switch}>
                                    <input type="checkbox" role="switch" checked={isPublic} disabled={busy} onChange={() => void toggleVisibility()} />
                                    Public
                                </label>
                            )}
                            <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={onEdit}>
                                <Icon name="edit" />
                                Edit details
                            </button>
                            {!organization && path.status === CatalogStatus.Draft && (
                                <button
                                    type="button"
                                    className={`${shared.button} ${shared.primary}`}
                                    disabled={busy}
                                    onClick={() => void run( () => send( `/paths/${path.id}`, { method: 'PATCH', body: { status: CatalogStatus.Published } } ) )}
                                >
                                    Publish
                                </button>
                            )}
                            {canDelete && (
                                <button type="button" className={`${shared.button} ${shared.ghost}`} onClick={() => setConfirming( true )}>
                                    <Icon name="trash" />
                                    Delete path
                                </button>
                            )}
                        </div>
                    )}
            {error && <p className={styles.error} role="alert">{error}</p>}
        </div>
    );
}

/** What happens to changes: who sees them, and (in the global catalog) whether learners see the path yet. */
function subtitle( path: LearningPathTreeJson, organization: MyOrganizationJson | null ): string {
    if ( organization?.isPersonal ) {
        return 'Saved · changes are live for everyone who follows this path';
    }
    if ( organization ) {
        return `In ${organization.name} · changes are live for every member who follows this path`;
    }

    return {
        [CatalogStatus.Draft]: 'Global catalog · a draft: learners see it once it\'s published',
        [CatalogStatus.Published]: 'Global catalog · changes are live for everyone who follows this path',
        [CatalogStatus.Archived]: 'Global catalog · archived: it\'s out of the catalog, and its followers keep it',
    }[path.status];
}
