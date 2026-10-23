import type { MemberJson, MyOrganizationJson } from '@studylog/schemas';
import { OrganizationRole } from '@studylog/schemas/enums';
import { useState } from 'react';

import { useAuth } from '../../auth/auth-context.ts';
import dialog from '../../components/Dialog.module.css';
import { Dialog } from '../../components/Dialog.tsx';
import { Icon } from '../../components/Icon.tsx';
import type { MenuAction } from '../../components/Menu.tsx';
import { Menu } from '../../components/Menu.tsx';
import { formatMonth } from '../../format/format.ts';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Organizations.module.css';
import { initials, ROLE_BADGES, ROLE_LABELS, saveError } from './organizations.ts';

interface MembersProps {
    organization: MyOrganizationJson;
    members: MemberJson[];
    /** After a role change or removal. */
    onChanged: () => void;
    /** After the user left. */
    onLeft: () => void;
}

/** A change waiting for "Remove"/"Leave" to be confirmed. */
type Confirming = { kind: 'remove'; member: MemberJson } | { kind: 'leave' };

/**
 * The members (Figma: Organization › Members), searchable by name or email. Each row's menu offers what the user may
 * do: owners change anyone's role (including making owners) and remove people; admins do the same for admins and
 * members. Anyone can leave, except the last owner (the API explains).
 */
export function Members( { organization, members, onChanged, onLeft }: MembersProps ) {
    const { request, state } = useAuth();
    // Only rendered inside <RequireAuth>, so there is a session.
    const userId = ( state as Extract<typeof state, { status: 'authenticated' }> ).session.user.id;
    const [ search, setSearch ] = useState( '' );
    const [ error, setError ] = useState<string>();
    const [ confirming, setConfirming ] = useState<Confirming>();
    const me = organization.role;
    const words = search.trim().toLowerCase();
    const shown = members.filter( ( member ) =>
        `${member.firstName} ${member.lastName} ${member.email}`.toLowerCase().includes( words ) );

    const change = async ( send: () => Promise<unknown>, after: () => void ) => {
        setError( undefined );
        try {
            await send();
            after();
        } catch ( failure ) {
            setError( saveError( failure ) );
        }
    };
    const memberUrl = ( member: MemberJson ) => `/organizations/${organization.id}/members/${member.userId}`;
    const setRole = ( member: MemberJson, role: OrganizationRole ) =>
        void change( () => request( memberUrl( member ), { method: 'PATCH', body: { role } } ), onChanged );

    const actionsFor = ( member: MemberJson ): MenuAction[] => {
        if ( member.userId === userId ) {
            return [ { label: 'Leave organization', danger: true, onSelect: () => setConfirming( { kind: 'leave' } ) } ];
        }

        const mayManage = me === OrganizationRole.Owner
            || ( me === OrganizationRole.Admin && member.role !== OrganizationRole.Owner );

        if ( !mayManage ) {
            return [];
        }

        return [
            {
                label: 'Make owner',
                hidden: me !== OrganizationRole.Owner || member.role === OrganizationRole.Owner,
                onSelect: () => setRole( member, OrganizationRole.Owner ),
            },
            { label: 'Make admin', hidden: member.role === OrganizationRole.Admin, onSelect: () => setRole( member, OrganizationRole.Admin ) },
            { label: 'Make member', hidden: member.role === OrganizationRole.Member, onSelect: () => setRole( member, OrganizationRole.Member ) },
            { label: 'Remove from organization', danger: true, onSelect: () => setConfirming( { kind: 'remove', member } ) },
        ];
    };

    return (
        <>
            <label className={styles.search}>
                <Icon name="search" />
                <span className="visually-hidden">Search members</span>
                <input type="search" placeholder="Search members" value={search} onChange={( event ) => setSearch( event.target.value )} />
            </label>
            {error && <p className={app.error} role="alert">{error}</p>}
            <section className={`${app.card} ${styles.members}`} aria-label="Members">
                {shown.length === 0 && <p className={app.empty}>{`No members match “${search.trim()}”.`}</p>}
                <ul className={styles.rows}>
                    {shown.map( ( member ) => {
                        const name = `${member.firstName} ${member.lastName}`;
                        const actions = organization.isPersonal ? [] : actionsFor( member );

                        return (
                            <li key={member.userId} className={styles.member}>
                                <span className={`${styles.avatar} ${styles.avatarLarge}`} aria-hidden="true">
                                    {initials( member.firstName, member.lastName )}
                                </span>
                                <div className={styles.copy}>
                                    <p className={styles.strong}>{member.userId === userId ? `${name} (you)` : name}</p>
                                    <p className={`${app.muted} ${app.small}`}>{member.email}</p>
                                </div>
                                <span className={styles.meta}>
                                    <span className={ROLE_BADGES[member.role]}>{ROLE_LABELS[member.role]}</span>
                                    <span className={styles.joined}>{`Joined ${formatMonth( member.joinedAt )}`}</span>
                                </span>
                                {actions.length > 0 && <Menu label={`Actions for ${name}`} actions={actions} />}
                            </li>
                        );
                    } )}
                </ul>
            </section>
            {confirming?.kind === 'remove' && (
                <ConfirmDialog
                    title={`Remove ${confirming.member.firstName} ${confirming.member.lastName}?`}
                    description={`They lose access to ${organization.name} and its paths. You can invite them again later.`}
                    action="Remove"
                    onClose={() => setConfirming( undefined )}
                    onConfirm={() => change( () => request( memberUrl( confirming.member ), { method: 'DELETE' } ), onChanged )}
                />
            )}
            {confirming?.kind === 'leave' && (
                <ConfirmDialog
                    title={`Leave ${organization.name}?`}
                    description="You lose access to its paths. An owner or admin can invite you again."
                    action="Leave organization"
                    onClose={() => setConfirming( undefined )}
                    onConfirm={() => change( () => request( `/organizations/${organization.id}/leave`, { method: 'POST' } ), onLeft )}
                />
            )}
        </>
    );
}

/** "Are you sure?" for removing someone or leaving; closes once the change was tried (errors show on the page). */
function ConfirmDialog( { title, description, action, onConfirm, onClose }: {
    title: string;
    description: string;
    action: string;
    onConfirm: () => Promise<void>;
    onClose: () => void;
} ) {
    const [ busy, setBusy ] = useState( false );

    return (
        <Dialog title={title} description={description} onClose={onClose}>
            <div className={dialog.actions}>
                <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={onClose}>Cancel</button>
                <button
                    type="button"
                    className={`${shared.button} ${shared.danger}`}
                    disabled={busy}
                    onClick={() => {
                        setBusy( true );
                        void onConfirm().then( onClose );
                    }}
                >
                    {action}
                </button>
            </div>
        </Dialog>
    );
}
