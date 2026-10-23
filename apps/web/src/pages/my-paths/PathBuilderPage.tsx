import type { LearningPathTreeJson, MyOrganizationJson } from '@studylog/schemas';
import { PathVisibility } from '@studylog/schemas/enums';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { useAuth } from '../../auth/auth-context.ts';
import { AppLayout } from '../../components/AppLayout.tsx';
import { Icon } from '../../components/Icon.tsx';
import { CardSkeleton, LoadError, Loading } from '../../components/LoadStates.tsx';
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
import { usePathBuilder } from './use-path-builder.ts';

/**
 * Builds a path (Figma: M4 · Build your own › Path builder): its modules and topics on the left, the chosen one on
 * the right with, for a topic, its items. Every change is saved right away.
 */
export function PathBuilderPage() {
    const { organizationId = '', pathId = '' } = useParams();
    const { state, reload, send } = usePathBuilder( organizationId, pathId );

    return (
        <AppLayout>
            <Link
                to={`/app/my-paths?org=${organizationId}`}
                className={`${shared.button} ${shared.ghost} ${shared.small} ${styles.back}`}
                aria-label="Back to my paths"
            >
                <Icon name="chevron-left" />
                My paths
            </Link>

            {state.status === 'loading' && <Loading text="Loading the path…"><CardSkeleton lines={5} /></Loading>}
            {state.status === 'error' && <LoadError message={state.message} retry={reload} />}
            {state.status === 'ready' && <Builder path={state.path} organization={state.organization} send={send} />}
        </AppLayout>
    );
}

interface BuilderProps {
    path: LearningPathTreeJson;
    organization: MyOrganizationJson;
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
                    <NodeEditor key={nodeKey( selected )} selected={selected} path={path} send={send} />
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
    const canPublish = organization.isPersonal && ( isPublic || path.publicBlockedAt === null );

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
        await request( `/organizations/${organization.id}/catalog/paths/${path.id}`, { method: 'DELETE' } );
        void navigate( `/app/my-paths?org=${organization.id}` );
    } );

    return (
        <div className={styles.header}>
            <div className={app.titleBlock}>
                <div className={styles.titleRow}>
                    <h1 className={app.title}>{path.title}</h1>
                    {organization.isPersonal && (
                        <span className={`${app.badge} ${isPublic ? app.badgeSuccess : ''}`}>{isPublic ? 'Public' : 'Private'}</span>
                    )}
                </div>
                <p className={app.muted}>
                    {organization.isPersonal
                        ? 'Saved · changes are live for everyone who follows this path'
                        : `In ${organization.name} · changes are live for every member who follows this path`}
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
                            <button type="button" className={`${shared.button} ${shared.ghost}`} onClick={() => setConfirming( true )}>
                                <Icon name="trash" />
                                Delete path
                            </button>
                        </div>
                    )}
            {error && <p className={styles.error} role="alert">{error}</p>}
        </div>
    );
}
