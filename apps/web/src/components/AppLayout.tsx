import { PlatformRole } from '@studylog/schemas/enums';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { useAuth } from '../auth/auth-context.ts';
import { UPCOMING } from '../pages/coming-soon/upcoming.ts';
import styles from './AppLayout.module.css';
import type { IconName } from './Icon.tsx';
import { Icon } from './Icon.tsx';
import { Logo } from './Logo.tsx';

interface NavItem {
    to: string;
    label: string;
    icon: IconName;
    /** Other paths that belong to this section, e.g. a path page belongs to the dashboard. */
    also?: string;
}

const LINKS: NavItem[] = [
    { to: '/app', label: 'Dashboard', icon: 'dashboard', also: '/app/paths/' },
    { to: UPCOMING.catalog.path, label: 'Browse paths', icon: 'compass' },
    { to: '/app/sessions', label: 'Sessions', icon: 'clock' },
    { to: UPCOMING.analytics.path, label: 'Analytics', icon: 'bar-chart' },
    { to: UPCOMING.readiness.path, label: 'Interview ready', icon: 'target' },
    { to: UPCOMING.myPaths.path, label: 'My paths', icon: 'layers' },
    { to: UPCOMING.organizations.path, label: 'Organizations', icon: 'users' },
];

/** Under the main links, above the account. Admin only for superadmins. */
const FOOTER_LINKS: ( NavItem & { superadmin?: boolean } )[] = [
    { to: UPCOMING.admin.path, label: 'Admin', icon: 'shield', superadmin: true },
    { to: UPCOMING.settings.path, label: 'Settings', icon: 'sliders' },
];

/**
 * The logged-in app: a dark sidebar with the app's pages, who is logged in and logging out, next to the page. On
 * narrow screens the sidebar becomes a top bar whose menu button shows the same links.
 */
export function AppLayout( { children }: { children: ReactNode } ) {
    const { state, logOut } = useAuth();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [ menuOpen, setMenuOpen ] = useState( false );
    // Only rendered inside <RequireAuth>, so there is a session.
    const { user } = ( state as Extract<typeof state, { status: 'authenticated' }> ).session;

    const navLink = ( link: NavItem ) => {
        const current = pathname === link.to || ( link.also !== undefined && pathname.startsWith( link.also ) );

        return (
            <Link
                key={link.to}
                to={link.to}
                className={styles.link}
                aria-current={current ? 'page' : undefined}
                onClick={() => setMenuOpen( false )}
            >
                <Icon name={link.icon} />
                {link.label}
            </Link>
        );
    };

    // Leave the page first: once the session is gone, it would send the user to the login page instead.
    const onLogOut = async () => {
        void navigate( '/', { replace: true } );
        await logOut();
    };

    return (
        <div className={styles.page}>
            <header className={styles.sidebar} data-open={menuOpen}>
                <div className={styles.top}>
                    <Link to="/app" className={styles.home} aria-label="StudyLog dashboard">
                        <Logo />
                    </Link>
                    <button
                        type="button"
                        className={styles.menuButton}
                        aria-expanded={menuOpen}
                        aria-controls="app-menu"
                        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                        onClick={() => setMenuOpen( ( open ) => !open )}
                    >
                        <Icon name={menuOpen ? 'x' : 'menu'} size={20} />
                    </button>
                </div>
                <div id="app-menu" className={styles.menu}>
                    <nav className={styles.nav} aria-label="Main">
                        {LINKS.map( ( link ) => navLink( link ) )}
                    </nav>
                    <div className={styles.bottom}>
                        <nav className={styles.nav} aria-label="Admin and settings">
                            {FOOTER_LINKS
                                .filter( ( link ) => !link.superadmin || user.platformRole === PlatformRole.Superadmin )
                                .map( ( link ) => navLink( link ) )}
                        </nav>
                        <div className={styles.account}>
                            <span className={styles.avatar} aria-hidden="true">{`${user.firstName.charAt( 0 )}${user.lastName.charAt( 0 )}`.toUpperCase()}</span>
                            <span className={styles.who}>
                                <span className={styles.name}>{`${user.firstName} ${user.lastName}`}</span>
                                <span className={styles.email}>{user.email}</span>
                            </span>
                            <button type="button" className={styles.logOut} aria-label="Log out" title="Log out" onClick={() => void onLogOut()}>
                                <Icon name="log-out" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>
            <main className={styles.main}>
                <div className={styles.content}>{children}</div>
            </main>
        </div>
    );
}
