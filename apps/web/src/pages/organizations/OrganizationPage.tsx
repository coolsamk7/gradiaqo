import type { InvitationJson, MemberJson, MyOrganizationJson, PublishedPathSummaryJson } from '@studylog/schemas';
import { OrganizationRole } from '@studylog/schemas/enums';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { useLoaded } from '../../api/use-loaded.ts';
import { useAuth } from '../../auth/auth-context.ts';
import { AppLayout } from '../../components/AppLayout.tsx';
import { Icon } from '../../components/Icon.tsx';
import { CardSkeleton, LoadError, Loading } from '../../components/LoadStates.tsx';
import { formatMonth } from '../../format/format.ts';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import catalog from '../catalog/Catalog.module.css';
import { PathCard } from '../catalog/PathCard.tsx';
import { Invitations } from './Invitations.tsx';
import { Members } from './Members.tsx';
import { DeleteOrganizationDialog, RenameOrganizationDialog } from './OrganizationDialogs.tsx';
import styles from './Organizations.module.css';
import { canManage, count, loadError, ROLE_BADGES, ROLE_LABELS } from './organizations.ts';

const TABS = [ 'members', 'invitations', 'paths' ] as const;

type Tab = typeof TABS[number];

/**
 * One organization (Figma: M4 · Teams & creators › Organization): its members, invitations (owners and admins) and
 * published paths, as tabs (`?tab=`). Owners and admins rename it; owners delete it.
 */
export function OrganizationPage() {
    const { organizationId = '' } = useParams();
    const navigate = useNavigate();
    const base = `/organizations/${organizationId}`;
    const organization = useLoaded<MyOrganizationJson>( base, loadError );
    const members = useLoaded<MemberJson[]>( `${base}/members`, loadError );
    const org = organization.state.status === 'ready' ? organization.state.value : undefined;
    const managed = org !== undefined && canManage( org.role ) && !org.isPersonal;
    const invitations = useLoaded<InvitationJson[]>( managed ? `${base}/invitations` : undefined, loadError );
    const paths = useLoaded<PublishedPathSummaryJson[]>(
        org && `/catalog/paths?source=${org.isPersonal ? 'mine' : 'organizations'}`,
        loadError,
    );
    const failed = [ organization.state, members.state ].find( ( state ) => state.status === 'error' );

    return (
        <AppLayout>
            <Link
                to="/app/organizations"
                className={`${shared.button} ${shared.ghost} ${shared.small} ${styles.back}`}
                aria-label="Back to organizations"
            >
                <Icon name="chevron-left" />
                Organizations
            </Link>

            {failed?.status === 'error' && (
                <LoadError
                    message={failed.message}
                    retry={() => {
                        organization.reload();
                        members.reload();
                    }}
                />
            )}
            {!failed && ( !org || members.state.status !== 'ready' ) && (
                <Loading text="Loading the organization…">
                    <CardSkeleton lines={4} />
                </Loading>
            )}
            {org && members.state.status === 'ready' && (
                <Organization
                    organization={org}
                    members={members.state.value}
                    invitations={invitations.state.status === 'ready' ? invitations.state.value : undefined}
                    paths={paths.state.status === 'ready'
                        ? paths.state.value.filter( ( path ) => path.organization?.id === org.id )
                        : undefined}
                    pathsError={paths.state.status === 'error' ? paths.state.message : undefined}
                    reload={{
                        organization: organization.reload,
                        members: members.reload,
                        invitations: invitations.reload,
                        paths: paths.reload,
                    }}
                    onLeft={() => void navigate( '/app/organizations', { replace: true } )}
                />
            )}
        </AppLayout>
    );
}

interface OrganizationProps {
    organization: MyOrganizationJson;
    members: MemberJson[];
    /** Undefined while loading, or when the user doesn't manage the organization. */
    invitations: InvitationJson[] | undefined;
    /** Its published paths; undefined while loading. */
    paths: PublishedPathSummaryJson[] | undefined;
    pathsError: string | undefined;
    reload: Record<'organization' | 'members' | 'invitations' | 'paths', () => void>;
    onLeft: () => void;
}

function Organization( { organization, members, invitations, paths, pathsError, reload, onLeft }: OrganizationProps ) {
    const { state } = useAuth();
    // Only rendered inside <RequireAuth>, so there is a session.
    const userId = ( state as Extract<typeof state, { status: 'authenticated' }> ).session.user.id;
    const [ params, setParams ] = useSearchParams();
    const [ dialog, setDialog ] = useState<'rename' | 'delete'>();
    const { role, isPersonal } = organization;
    const managed = canManage( role ) && !isPersonal;
    const tabs = TABS.filter( ( tab ) => tab !== 'invitations' || managed );
    const asked = params.get( 'tab' ) as Tab | null;
    const tab: Tab = asked && tabs.includes( asked ) ? asked : 'members';
    const label: Record<Tab, string> = {
        members: 'Members',
        invitations: invitations ? `Invitations · ${invitations.length}` : 'Invitations',
        paths: 'Paths',
    };
    const pathCount = paths?.length;
    const inviteArea = invitations && (
        <Invitations organization={organization} invitations={invitations} onChanged={reload.invitations} />
    );

    return (
        <>
            <div className={app.header}>
                <div className={app.titleBlock}>
                    <div className={styles.titleRow}>
                        <h1 className={app.title}>{organization.name}</h1>
                        {isPersonal
                            ? <span className={app.badge}>Personal</span>
                            : role && <span className={ROLE_BADGES[role]}>{ROLE_LABELS[role]}</span>}
                    </div>
                    <p className={app.muted}>
                        {[
                            count( members.length, 'member' ),
                            pathCount !== undefined && count( pathCount, 'path' ),
                            `created ${formatMonth( organization.createdAt )}`,
                        ].filter( Boolean ).join( ' · ' )}
                    </p>
                </div>
                {managed && (
                    <div className={styles.actions}>
                        <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={() => setDialog( 'rename' )}>
                            <Icon name="edit" />
                            Rename
                        </button>
                        {role === OrganizationRole.Owner && (
                            <button type="button" className={`${shared.button} ${shared.ghost}`} onClick={() => setDialog( 'delete' )}>
                                Delete
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className={styles.tabs} role="tablist" aria-label="Sections">
                {tabs.map( ( name ) => (
                    <button
                        key={name}
                        type="button"
                        role="tab"
                        id={`tab-${name}`}
                        className={styles.tab}
                        aria-selected={tab === name}
                        aria-controls="tab-panel"
                        onClick={() => setParams( name === 'members' ? {} : { tab: name }, { replace: true } )}
                    >
                        {label[name]}
                    </button>
                ) )}
            </div>

            <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className={styles.stack}>
                {tab === 'members' && (
                    <>
                        <Members
                            organization={organization}
                            members={members}
                            onChanged={() => {
                                reload.members();
                                reload.organization();
                            }}
                            onLeft={onLeft}
                        />
                        {inviteArea}
                    </>
                )}
                {tab === 'invitations' && inviteArea}
                {tab === 'paths' && (
                    <Paths
                        organization={organization}
                        paths={paths}
                        error={pathsError}
                        userId={userId}
                        retry={reload.paths}
                    />
                )}
            </div>

            {dialog === 'rename' && (
                <RenameOrganizationDialog
                    organization={organization}
                    onClose={() => setDialog( undefined )}
                    onRenamed={() => {
                        setDialog( undefined );
                        reload.organization();
                    }}
                />
            )}
            {dialog === 'delete' && (
                <DeleteOrganizationDialog
                    organization={organization}
                    members={members.length}
                    paths={pathCount}
                    onClose={() => setDialog( undefined )}
                />
            )}
        </>
    );
}

/** The organization's published paths as catalog cards; owners and admins build them in My paths. */
function Paths( { organization, paths, error, userId, retry }: {
    organization: MyOrganizationJson;
    paths: PublishedPathSummaryJson[] | undefined;
    error: string | undefined;
    userId: string;
    retry: () => void;
} ) {
    const builds = canManage( organization.role );

    if ( error ) {
        return <LoadError message={error} retry={retry} />;
    }
    if ( !paths ) {
        return <Loading text="Loading the paths…" />;
    }

    return (
        <>
            {paths.length === 0 && (
                <section className={`${app.card} ${app.empty}`} aria-label="No paths">
                    <p>No published paths here yet.</p>
                </section>
            )}
            {paths.length > 0 && (
                <ul className={catalog.grid} aria-label="Paths">
                    {paths.map( ( path ) => <PathCard key={path.id} path={path} userId={userId} /> )}
                </ul>
            )}
            {builds && (
                <p className={app.muted}>
                    {'Drafts and editing are in '}
                    <Link to={`/app/my-paths?org=${organization.id}`} className={app.cardLink}>My paths</Link>
                    .
                </p>
            )}
        </>
    );
}
