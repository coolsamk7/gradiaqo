import type { ReportPageJson } from '@studylog/schemas';
import { Link, useLocation } from 'react-router';

import { useLoaded } from '../../api/use-loaded.ts';
import styles from './Admin.module.css';
import { loadError } from './catalog.ts';

/** The admin sections, at the top of every admin page. Reports shows how many are open. */
export function AdminNav() {
    const { pathname } = useLocation();
    const reports = useLoaded<ReportPageJson>( '/admin/reports?limit=1', loadError );
    const sections = [
        { to: '/app/admin', label: 'Overview' },
        { to: '/app/admin/catalog', label: 'Catalog' },
        { to: '/app/admin/reports', label: reports.state.status === 'ready' ? `Reports · ${reports.state.value.total}` : 'Reports' },
        { to: '/app/admin/users', label: 'Users' },
        { to: '/app/admin/organizations', label: 'Organizations' },
    ];

    return (
        <nav className={styles.tabs} aria-label="Admin">
            {sections.map( ( section ) => (
                <Link
                    key={section.to}
                    to={section.to}
                    className={styles.tab}
                    aria-current={pathname === section.to ? 'page' : undefined}
                >
                    {section.label}
                </Link>
            ) )}
        </nav>
    );
}
