import type { AdminUserJson, AdminUserPageJson } from '@studylog/schemas';
import { PlatformRole } from '@studylog/schemas/enums';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import { useLoaded } from '../../api/use-loaded.ts';
import { useAuth } from '../../auth/auth-context.ts';
import { AppLayout } from '../../components/AppLayout.tsx';
import dialog from '../../components/Dialog.module.css';
import { Dialog } from '../../components/Dialog.tsx';
import { Icon } from '../../components/Icon.tsx';
import { CardSkeleton, LoadError, Loading } from '../../components/LoadStates.tsx';
import { Menu } from '../../components/Menu.tsx';
import { formatMonth } from '../../format/format.ts';
import { fieldProps } from '../../forms/field-props.ts';
import form from '../../forms/form.module.css';
import { FormField } from '../../forms/FormField.tsx';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Admin.module.css';
import { AdminNav } from './AdminNav.tsx';
import { loadError } from './catalog.ts';
import type { UserFilters } from './users.ts';
import { actionError, lastActive, PAGE_SIZE, pageLabel, userActions, usersUrl } from './users.ts';

/** How long to wait after typing in the search before asking the API. */
const SEARCH_DELAY_MS = 300;

/**
 * Every account, for superadmins: find people by email or name, see who verified their email and when they were last
 * active, promote or demote superadmins, and remove an account. Follows the global catalog's table.
 */
export function UsersPage() {
    const { state: auth, request } = useAuth();
    // Only rendered inside <RequireSuperadmin>, so there is a session.
    const me = ( auth as Extract<typeof auth, { status: 'authenticated' }> ).session.user;
    const [ typed, setTyped ] = useState( '' );
    const [ filters, setFilters ] = useState<UserFilters>( { search: '', role: '', verified: '', offset: 0 } );
    const users = useLoaded<AdminUserPageJson>( usersUrl( filters ), loadError );
    const [ removing, setRemoving ] = useState<AdminUserJson>();
    const [ error, setError ] = useState<string>();
    const now = new Date();

    // One request for the whole word, not one per letter; a new search (only) starts at the first page.
    useEffect( () => {
        const timer = setTimeout(
            () => setFilters( ( current ) =>
                ( current.search === typed.trim() ? current : { ...current, search: typed.trim(), offset: 0 } ) ),
            SEARCH_DELAY_MS,
        );

        return () => clearTimeout( timer );
    }, [ typed ] );

    const filter = ( change: Partial<UserFilters> ) =>
        setFilters( ( current ) => ( { ...current, ...change, offset: 0 } ) );

    const setRole = async ( user: AdminUserJson, platformRole: PlatformRole ) => {
        setError( undefined );
        try {
            await request( `/admin/users/${user.id}`, { method: 'PATCH', body: { platformRole } } );
            users.reload();
        } catch ( failure ) {
            setError( actionError( failure ) );
        }
    };

    return (
        <AppLayout>
            <div className={app.header}>
                <div className={app.titleBlock}>
                    <div className={styles.titleRow}>
                        <h1 className={app.title}>Users</h1>
                        <span className={`${app.badge} ${app.badgeInverse}`}>Admin</span>
                    </div>
                    <p className={app.muted}>
                        Everyone with an account. A new superadmin sees Admin within 15 minutes, or at their next login.
                    </p>
                </div>
            </div>
            <AdminNav />

            <div className={styles.toolbar}>
                <label className={styles.search}>
                    <Icon name="search" />
                    <span className="visually-hidden">Search users</span>
                    <input type="search" placeholder="Search by email or name" value={typed} onChange={( event ) => setTyped( event.target.value )} />
                </label>
                <label className={styles.filter}>
                    <span className="visually-hidden">Role</span>
                    <select className={form.input} value={filters.role} onChange={( event ) => filter( { role: event.target.value as PlatformRole | '' } )}>
                        <option value="">All roles</option>
                        <option value={PlatformRole.Superadmin}>Superadmins</option>
                        <option value={PlatformRole.ApplicationUser}>Users</option>
                    </select>
                </label>
                <label className={styles.filter}>
                    <span className="visually-hidden">Email</span>
                    <select className={form.input} value={filters.verified} onChange={( event ) => filter( { verified: event.target.value as UserFilters['verified'] } )}>
                        <option value="">Any email</option>
                        <option value="yes">Verified</option>
                        <option value="no">Not verified</option>
                    </select>
                </label>
            </div>
            {error && <p className={app.error} role="alert">{error}</p>}
            {users.state.status === 'loading' && <Loading text="Loading the users…"><CardSkeleton lines={4} /></Loading>}
            {users.state.status === 'error' && <LoadError message={users.state.message} retry={users.reload} />}
            {users.state.status === 'ready' && (
                <section className={`${app.card} ${styles.tableCard}`} aria-label="Users">
                    {users.state.value.items.length === 0
                        ? <p className={app.empty}>No users match.</p>
                        : (
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th scope="col">User</th>
                                            <th scope="col">Role</th>
                                            <th scope="col">Email</th>
                                            <th scope="col">Joined</th>
                                            <th scope="col">Last active</th>
                                            <th scope="col"><span className="visually-hidden">Actions</span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.state.value.items.map( ( user ) => (
                                            <tr key={user.id}>
                                                <th scope="row">
                                                    <span className={styles.person}>
                                                        {`${user.firstName} ${user.lastName}`}
                                                        {user.id === me.id && <span className={app.muted}> (you)</span>}
                                                    </span>
                                                    <span className={`${app.muted} ${app.small}`}>{user.email}</span>
                                                </th>
                                                <td>
                                                    {user.platformRole === PlatformRole.Superadmin
                                                        ? <span className={`${app.badge} ${app.badgeInverse}`}>Superadmin</span>
                                                        : <span className={app.muted}>User</span>}
                                                </td>
                                                <td>
                                                    {user.emailVerifiedAt
                                                        ? <span className={`${app.badge} ${app.badgeSuccess}`}>Verified</span>
                                                        : <span className={`${app.badge} ${app.badgeWarning}`}>Not verified</span>}
                                                </td>
                                                <td className={app.muted}>{formatMonth( user.createdAt )}</td>
                                                <td className={app.muted}>{lastActive( user, now )}</td>
                                                <td>
                                                    <div className={styles.rowActions}>
                                                        <Menu
                                                            label={`More for ${user.email}`}
                                                            actions={userActions(
                                                                user,
                                                                me.id,
                                                                ( role ) => void setRole( user, role ),
                                                                () => setRemoving( user ),
                                                            )}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        ) )}
                                    </tbody>
                                </table>
                            )}
                    {users.state.value.total > PAGE_SIZE && (
                        <div className={styles.pager}>
                            <p className={`${app.muted} ${app.small}`}>
                                {pageLabel( filters.offset, users.state.value.items.length, users.state.value.total )}
                            </p>
                            <button
                                type="button"
                                className={`${shared.button} ${shared.secondary} ${shared.small}`}
                                disabled={filters.offset === 0}
                                onClick={() => setFilters( { ...filters, offset: filters.offset - PAGE_SIZE } )}
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                className={`${shared.button} ${shared.secondary} ${shared.small}`}
                                disabled={filters.offset + PAGE_SIZE >= users.state.value.total}
                                onClick={() => setFilters( { ...filters, offset: filters.offset + PAGE_SIZE } )}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </section>
            )}
            {removing && (
                <RemoveUserDialog
                    user={removing}
                    onClose={() => setRemoving( undefined )}
                    onRemoved={() => {
                        setRemoving( undefined );
                        users.reload();
                    }}
                />
            )}
        </AppLayout>
    );
}

/** Typing the email confirms it: removing an account can't be undone. */
function RemoveUserDialog( { user, onClose, onRemoved }: {
    user: AdminUserJson;
    onClose: () => void;
    onRemoved: () => void;
} ) {
    const { request } = useAuth();
    const [ typed, setTyped ] = useState( '' );
    const [ error, setError ] = useState<string>();
    const [ formError, setFormError ] = useState<string>();
    const [ removing, setRemoving ] = useState( false );

    const onSubmit = async ( event: FormEvent<HTMLFormElement> ) => {
        event.preventDefault();
        setFormError( undefined );
        if ( typed.trim().toLowerCase() !== user.email ) {
            setError( 'Type the email exactly as it is shown.' );

            return;
        }

        setError( undefined );
        setRemoving( true );
        try {
            await request( `/admin/users/${user.id}`, { method: 'DELETE' } );
            onRemoved();
        } catch ( failure ) {
            setFormError( actionError( failure ) );
            setRemoving( false );
        }
    };

    return (
        <Dialog
            title={`Remove ${user.firstName} ${user.lastName}?`}
            description={`This deletes ${user.email} with their personal workspace, organizations they're alone in, enrollments, progress and study sessions. It can't be undone.`}
            onClose={onClose}
        >
            <form className={styles.dialogForm} onSubmit={( event ) => void onSubmit( event )} noValidate>
                {formError && <p className={`${form.formError} ${styles.flush}`} role="alert">{formError}</p>}
                <FormField field="confirm-email" label="Type their email to confirm" error={error}>
                    <input
                        {...fieldProps( 'confirm-email', error )}
                        autoComplete="off"
                        autoFocus
                        value={typed}
                        onChange={( event ) => setTyped( event.target.value )}
                    />
                </FormField>
                <div className={dialog.actions}>
                    <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={onClose}>Cancel</button>
                    <button type="submit" className={`${shared.button} ${shared.danger}`} disabled={removing}>
                        {removing ? 'Removing…' : 'Remove account'}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}
