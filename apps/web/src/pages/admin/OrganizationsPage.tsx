import type { AdminOrganizationPageJson } from '@studylog/schemas';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { useLoaded } from '../../api/use-loaded.ts';
import { AppLayout } from '../../components/AppLayout.tsx';
import { Icon } from '../../components/Icon.tsx';
import { CardSkeleton, LoadError, Loading } from '../../components/LoadStates.tsx';
import { formatMonth } from '../../format/format.ts';
import form from '../../forms/form.module.css';
import app from '../../styles/app.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Admin.module.css';
import { AdminNav } from './AdminNav.tsx';
import { loadError } from './catalog.ts';
import type { OrganizationFilters } from './organizations.ts';
import { organizationsUrl, ownersLabel } from './organizations.ts';
import { PAGE_SIZE, pageLabel } from './users.ts';

/** How long to wait after typing in the search before asking the API. */
const SEARCH_DELAY_MS = 300;

/**
 * Every organization, for superadmins handling abuse and support requests: find one by its name or a member's email,
 * then open it to see its members and paths (read-only for superadmins who aren't members).
 */
export function OrganizationsPage() {
    const [ typed, setTyped ] = useState( '' );
    const [ filters, setFilters ] = useState<OrganizationFilters>( { search: '', personal: false, offset: 0 } );
    const organizations = useLoaded<AdminOrganizationPageJson>( organizationsUrl( filters ), loadError );
    const page = organizations.state.status === 'ready' ? organizations.state.value : undefined;

    // One request for the whole word, not one per letter; a new search (only) starts at the first page.
    useEffect( () => {
        const timer = setTimeout(
            () => setFilters( ( current ) =>
                ( current.search === typed.trim() ? current : { ...current, search: typed.trim(), offset: 0 } ) ),
            SEARCH_DELAY_MS,
        );

        return () => clearTimeout( timer );
    }, [ typed ] );

    return (
        <AppLayout>
            <div className={app.header}>
                <div className={app.titleBlock}>
                    <div className={styles.titleRow}>
                        <h1 className={app.title}>Organizations</h1>
                        <span className={`${app.badge} ${app.badgeInverse}`}>Admin</span>
                    </div>
                    <p className={app.muted}>
                        Study groups and their owners. Open one to see its members and paths; you can look, not
                        change it.
                    </p>
                </div>
            </div>
            <AdminNav />

            <div className={styles.toolbar}>
                <label className={styles.search}>
                    <Icon name="search" />
                    <span className="visually-hidden">Search organizations</span>
                    <input type="search" placeholder="Search by name or a member's email" value={typed} onChange={( event ) => setTyped( event.target.value )} />
                </label>
                <label className={styles.filter}>
                    <span className="visually-hidden">Kind</span>
                    <select
                        className={form.input}
                        value={filters.personal ? 'all' : 'groups'}
                        onChange={( event ) => setFilters( { ...filters, personal: event.target.value === 'all', offset: 0 } )}
                    >
                        <option value="groups">Groups</option>
                        <option value="all">Groups and personal workspaces</option>
                    </select>
                </label>
            </div>
            {organizations.state.status === 'loading' && <Loading text="Loading the organizations…"><CardSkeleton lines={4} /></Loading>}
            {organizations.state.status === 'error' && <LoadError message={organizations.state.message} retry={organizations.reload} />}
            {page && (
                <section className={`${app.card} ${styles.tableCard}`} aria-label="Organizations">
                    {page.items.length === 0
                        ? <p className={app.empty}>No organizations match.</p>
                        : (
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th scope="col">Organization</th>
                                            <th scope="col">Owner</th>
                                            <th scope="col">Members</th>
                                            <th scope="col">Paths</th>
                                            <th scope="col">Created</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {page.items.map( ( organization ) => (
                                            <tr key={organization.id}>
                                                <th scope="row">
                                                    <Link to={`/app/organizations/${organization.id}`} className={styles.pathLink}>
                                                        {organization.name}
                                                    </Link>
                                                    {organization.isPersonal && <span className={`${app.badge} ${styles.inlineBadge}`}>Personal</span>}
                                                </th>
                                                <td className={app.muted}>{ownersLabel( organization )}</td>
                                                <td>{organization.memberCount}</td>
                                                <td>{organization.pathCount}</td>
                                                <td className={app.muted}>{formatMonth( organization.createdAt )}</td>
                                            </tr>
                                        ) )}
                                    </tbody>
                                </table>
                            )}
                    {page.total > PAGE_SIZE && (
                        <div className={styles.pager}>
                            <p className={`${app.muted} ${app.small}`}>{pageLabel( filters.offset, page.items.length, page.total )}</p>
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
                                disabled={filters.offset + PAGE_SIZE >= page.total}
                                onClick={() => setFilters( { ...filters, offset: filters.offset + PAGE_SIZE } )}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </section>
            )}
        </AppLayout>
    );
}
