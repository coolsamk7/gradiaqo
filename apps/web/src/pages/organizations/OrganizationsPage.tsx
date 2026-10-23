import type { MyInvitationJson, OrganizationSummaryJson } from '@studylog/schemas';
import { useState } from 'react';
import { Link } from 'react-router';

import { useLoaded } from '../../api/use-loaded.ts';
import { useAuth } from '../../auth/auth-context.ts';
import { AppLayout } from '../../components/AppLayout.tsx';
import { Icon } from '../../components/Icon.tsx';
import { CardSkeleton, LoadError, Loading } from '../../components/LoadStates.tsx';
import { formatMonth } from '../../format/format.ts';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import { NewOrganizationDialog } from './OrganizationDialogs.tsx';
import styles from './Organizations.module.css';
import {
    canManage,
    count,
    expiresIn,
    initials,
    loadError,
    ROLE_BADGES,
    ROLE_LABELS,
    saveError,
    withArticle,
} from './organizations.ts';

/**
 * The organizations the user belongs to (Figma: M4 · Teams & creators › Organizations): invitations waiting for them
 * first, then a card per organization, their personal workspace first.
 */
export function OrganizationsPage() {
    const organizations = useLoaded<OrganizationSummaryJson[]>( '/organizations', loadError );
    const invitations = useLoaded<MyInvitationJson[]>( '/me/invitations', loadError );
    const [ creating, setCreating ] = useState( false );

    return (
        <AppLayout>
            <div className={app.header}>
                <div className={app.titleBlock}>
                    <h1 className={app.title}>Organizations</h1>
                    <p className={app.muted}>Study together: share paths with your group and see who&apos;s in it.</p>
                </div>
                <button type="button" className={`${shared.button} ${shared.primary}`} onClick={() => setCreating( true )}>
                    <Icon name="plus" />
                    New organization
                </button>
            </div>

            {invitations.state.status === 'ready' && invitations.state.value.length > 0 && (
                <Invitations
                    invitations={invitations.state.value}
                    onAnswered={( accepted ) => {
                        invitations.reload();
                        if ( accepted ) {
                            organizations.reload();
                        }
                    }}
                />
            )}

            {organizations.state.status === 'loading' && (
                <Loading text="Loading your organizations…">
                    <div className={styles.cards}>
                        <CardSkeleton />
                        <CardSkeleton />
                    </div>
                </Loading>
            )}
            {organizations.state.status === 'error' && <LoadError message={organizations.state.message} retry={organizations.reload} />}
            {organizations.state.status === 'ready' && (
                <ul className={styles.cards} aria-label="Your organizations">
                    {organizations.state.value.map( ( organization ) => (
                        <OrganizationCard key={organization.id} organization={organization} />
                    ) )}
                </ul>
            )}

            {creating && <NewOrganizationDialog onClose={() => setCreating( false )} />}
        </AppLayout>
    );
}

/** "Invitations for you", each with Decline and Accept. `onAnswered` is told whether one was accepted. */
function Invitations( { invitations, onAnswered }: {
    invitations: MyInvitationJson[];
    onAnswered: ( accepted: boolean ) => void;
} ) {
    const { request } = useAuth();
    const [ busy, setBusy ] = useState<string>();
    const [ error, setError ] = useState<string>();
    const now = new Date();

    const answer = async ( invitation: MyInvitationJson, accept: boolean ) => {
        setBusy( invitation.id );
        setError( undefined );
        try {
            await request( `/me/invitations/${invitation.id}/${accept ? 'accept' : 'decline'}`, { method: 'POST' } );
            onAnswered( accept );
        } catch ( failure ) {
            setError( saveError( failure ) );
        }
        setBusy( undefined );
    };

    return (
        <section className={app.card} aria-labelledby="invites-title">
            <div className={styles.invitesHead}>
                <h2 id="invites-title" className={app.cardTitle}>Invitations for you</h2>
                <span className={`${app.badge} ${app.badgeAccent}`}>{`${invitations.length} new`}</span>
            </div>
            {error && <p className={app.error} role="alert">{error}</p>}
            <ul className={styles.rows}>
                {invitations.map( ( invitation ) => {
                    const from = invitation.invitedBy && `From ${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName} · `;

                    return (
                        <li key={invitation.id} className={styles.row}>
                            <span className={styles.chip} aria-hidden="true"><Icon name="mail" /></span>
                            <div className={styles.copy}>
                                <p className={styles.strong}>
                                    {`${invitation.organization.name} invited you as ${withArticle( invitation.role )}`}
                                </p>
                                <p className={`${app.muted} ${app.small}`}>{`${from ?? ''}${expiresIn( invitation.expiresAt, now )}`}</p>
                            </div>
                            <button
                                type="button"
                                className={`${shared.button} ${shared.ghost} ${shared.small}`}
                                disabled={busy !== undefined}
                                onClick={() => void answer( invitation, false )}
                            >
                                Decline
                            </button>
                            <button
                                type="button"
                                className={`${shared.button} ${shared.primary} ${shared.small}`}
                                disabled={busy !== undefined}
                                onClick={() => void answer( invitation, true )}
                            >
                                {busy === invitation.id ? 'Joining…' : 'Accept'}
                            </button>
                        </li>
                    );
                } )}
            </ul>
        </section>
    );
}

function OrganizationCard( { organization }: { organization: OrganizationSummaryJson } ) {
    const { isPersonal, role, memberCount, pathCount, members } = organization;
    const titleId = `organization-${organization.id}`;

    return (
        <li className={`${app.card} ${styles.card}`} aria-labelledby={titleId}>
            <div className={styles.top}>
                <span className={`${styles.chip} ${styles.chipLarge}`} aria-hidden="true">
                    <Icon name={isPersonal ? 'user' : 'users'} />
                </span>
                <div className={styles.name}>
                    <h2 id={titleId} className={`${app.cardTitle} ${styles.strong}`}>{organization.name}</h2>
                    <p className={`${app.muted} ${app.small}`}>
                        {isPersonal ? count( pathCount, 'path' ) : `${count( memberCount, 'member' )} · ${count( pathCount, 'path' )}`}
                    </p>
                </div>
                {isPersonal
                    ? <span className={app.badge}>Personal</span>
                    : role && <span className={ROLE_BADGES[role]}>{ROLE_LABELS[role]}</span>}
            </div>
            <p className={app.muted}>
                {isPersonal
                    ? 'Your own paths and items. Only you can see private paths here.'
                    : `Created ${formatMonth( organization.createdAt )}.`}
            </p>
            <div className={styles.footer}>
                <Avatars members={members} total={memberCount} />
                {isPersonal
                    ? <Link to={`/app/my-paths?org=${organization.id}`} className={`${shared.button} ${shared.secondary} ${shared.small}`}>Open workspace</Link>
                    : (
                            <Link
                                to={`/app/organizations/${organization.id}`}
                                className={`${shared.button} ${shared.secondary} ${shared.small}`}
                                aria-label={`${canManage( role ) ? 'Manage' : 'Open'} ${organization.name}`}
                            >
                                {canManage( role ) ? 'Manage' : 'Open'}
                            </Link>
                        )}
            </div>
        </li>
    );
}

/** The first few members' initials, overlapping, and "+N" for the rest. */
function Avatars( { members, total }: { members: OrganizationSummaryJson['members']; total: number } ) {
    const names = members.map( ( member ) => `${member.firstName} ${member.lastName}` );
    const rest = total - members.length;
    const label = `Members: ${names.join( ', ' )}${rest > 0 ? ` and ${rest} more` : ''}`;

    return (
        <div className={styles.avatars} role="img" aria-label={label}>
            {members.map( ( member ) => (
                <span key={member.userId} className={styles.avatar}>
                    {initials( member.firstName, member.lastName )}
                </span>
            ) )}
            {rest > 0 && <span className={`${styles.avatar} ${styles.more}`}>{`+${rest}`}</span>}
        </div>
    );
}
