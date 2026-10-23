import type { InvitationJson, MyOrganizationJson } from '@studylog/schemas';
import { OrganizationRole } from '@studylog/schemas/enums';
import type { FormEvent } from 'react';
import { useState } from 'react';

import { ApiError } from '../../api/client.ts';
import { useAuth } from '../../auth/auth-context.ts';
import { Icon } from '../../components/Icon.tsx';
import { fieldProps } from '../../forms/field-props.ts';
import form from '../../forms/form.module.css';
import { FormField } from '../../forms/FormField.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import { isEmail } from '../password-reset/reset.ts';
import styles from './Organizations.module.css';
import { expiresIn, ROLE_LABELS, saveError, sentAgo } from './organizations.ts';

interface InvitationsProps {
    organization: MyOrganizationJson;
    invitations: InvitationJson[];
    /** After an invitation was sent or revoked. */
    onChanged: () => void;
}

/** "Invite someone" and "Pending invitations", side by side (Figma: Organization). For owners and admins. */
export function Invitations( { organization, invitations, onChanged }: InvitationsProps ) {
    return (
        <div className={styles.inviteArea}>
            <InviteCard organization={organization} onSent={onChanged} />
            <PendingCard organization={organization} invitations={invitations} onRevoked={onChanged} />
        </div>
    );
}

function InviteCard( { organization, onSent }: { organization: MyOrganizationJson; onSent: () => void } ) {
    const { request } = useAuth();
    const [ email, setEmail ] = useState( '' );
    const [ role, setRole ] = useState( OrganizationRole.Member );
    const [ error, setError ] = useState<string>();
    const [ formError, setFormError ] = useState<string>();
    const [ sent, setSent ] = useState<string>();
    const [ sending, setSending ] = useState( false );

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        const address = email.trim().toLowerCase();

        setSent( undefined );
        setFormError( undefined );
        if ( !isEmail( address ) ) {
            setError( 'Enter a valid email address.' );
            document.getElementById( 'invite-email' )?.focus();

            return;
        }

        setError( undefined );
        setSending( true );
        try {
            await request( `/organizations/${organization.id}/invitations`, { method: 'POST', body: { email: address, role } } );
            setEmail( '' );
            setSent( `Invitation sent to ${address}.` );
            onSent();
        } catch ( failure ) {
            if ( failure instanceof ApiError && failure.fieldErrors.email ) {
                setError( 'Enter a valid email address.' );
            } else if ( failure instanceof ApiError && failure.status === 409 ) {
                setError( 'This person is already a member.' );
            } else if ( failure instanceof ApiError && failure.status === 429 ) {
                setFormError( 'You\'ve sent a lot of invitations. Wait a while before sending more.' );
            } else {
                setFormError( saveError( failure ) );
            }
        }
        setSending( false );
    };

    return (
        <section className={app.card} aria-labelledby="invite-title">
            <div className={styles.cardHead}>
                <h2 id="invite-title" className={app.cardTitle}>Invite someone</h2>
                <p className={`${app.muted} ${app.small}`}>
                    We email them a link. They see the invitation when they log in with this email. Invitations last
                    14 days.
                </p>
            </div>
            <form className={styles.form} onSubmit={( event ) => void onSubmit( event )} noValidate>
                {formError && <p className={`${form.formError} ${styles.flush}`} role="alert">{formError}</p>}
                <div className={styles.inviteForm}>
                    <FormField field="invite-email" label="Email" error={error}>
                        <input
                            {...fieldProps( 'invite-email', error )}
                            type="email"
                            autoComplete="off"
                            maxLength={255}
                            value={email}
                            onChange={( event ) => setEmail( event.target.value )}
                        />
                    </FormField>
                    <div className={styles.role}>
                        <FormField field="invite-role" label="Role">
                            <select
                                {...fieldProps( 'invite-role', undefined )}
                                value={role}
                                onChange={( event ) => setRole( event.target.value as OrganizationRole )}
                            >
                                <option value={OrganizationRole.Member}>Member</option>
                                <option value={OrganizationRole.Admin}>Admin</option>
                            </select>
                        </FormField>
                    </div>
                    <button type="submit" className={`${shared.button} ${shared.primary}`} disabled={sending}>
                        {sending ? 'Sending…' : 'Send invite'}
                    </button>
                </div>
                {sent && <p className={styles.sent} role="status">{sent}</p>}
            </form>
        </section>
    );
}

function PendingCard( { organization, invitations, onRevoked }: {
    organization: MyOrganizationJson;
    invitations: InvitationJson[];
    onRevoked: () => void;
} ) {
    const { request } = useAuth();
    const [ error, setError ] = useState<string>();
    const [ revoking, setRevoking ] = useState<string>();
    const now = new Date();

    const revoke = async ( invitation: InvitationJson ) => {
        setRevoking( invitation.id );
        setError( undefined );
        try {
            await request( `/organizations/${organization.id}/invitations/${invitation.id}`, { method: 'DELETE' } );
            onRevoked();
        } catch ( failure ) {
            setError( saveError( failure ) );
        }
        setRevoking( undefined );
    };

    return (
        <section className={app.card} aria-labelledby="pending-title">
            <h2 id="pending-title" className={app.cardTitle}>Pending invitations</h2>
            {error && <p className={app.error} role="alert">{error}</p>}
            {invitations.length === 0 && <p className={`${app.muted} ${styles.cardHead}`}>Nobody is waiting to join.</p>}
            <ul className={styles.rows}>
                {invitations.map( ( invitation ) => (
                    <li key={invitation.id} className={`${styles.row} ${styles.tight}`}>
                        <span className={`${styles.chip} ${styles.chipMuted}`} aria-hidden="true"><Icon name="mail" /></span>
                        <div className={styles.copy}>
                            <p className={styles.strong}>{invitation.email}</p>
                            <p className={`${app.muted} ${app.small}`}>
                                {`${ROLE_LABELS[invitation.role]} · ${sentAgo( invitation.createdAt, now )} · ${expiresIn( invitation.expiresAt, now )}`}
                            </p>
                        </div>
                        <button
                            type="button"
                            className={`${shared.button} ${shared.ghost} ${shared.small}`}
                            disabled={revoking !== undefined}
                            aria-label={`Revoke the invitation to ${invitation.email}`}
                            onClick={() => void revoke( invitation )}
                        >
                            {revoking === invitation.id ? 'Revoking…' : 'Revoke'}
                        </button>
                    </li>
                ) )}
            </ul>
        </section>
    );
}
