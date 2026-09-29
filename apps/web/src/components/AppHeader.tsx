import { NavLink, useNavigate } from 'react-router';

import { useAuth } from '../auth/auth-context.ts';
import shared from '../styles/shared.module.css';
import styles from './AppHeader.module.css';
import { Logo } from './Logo.tsx';

const LINKS = [
    { to: '/app', label: 'Dashboard' },
    { to: '/app/sessions', label: 'Sessions' },
];

/** The top bar of the logged-in app: logo, the app's pages, who is logged in, and logging out. */
export function AppHeader() {
    const { state, logOut } = useAuth();
    const navigate = useNavigate();
    // Only rendered inside <RequireAuth>, so there is a session.
    const { user } = ( state as Extract<typeof state, { status: 'authenticated' }> ).session;

    // Leave the page first: once the session is gone, it would send the user to the login page instead.
    const onLogOut = async () => {
        void navigate( '/', { replace: true } );
        await logOut();
    };

    return (
        <header className={styles.header}>
            <div className={`${shared.container} ${styles.bar}`}>
                <Logo />
                <nav className={styles.nav} aria-label="Main">
                    {LINKS.map( ( link ) => (
                        // `end`: /app is only current on the dashboard itself, not on /app/sessions.
                        <NavLink key={link.to} to={link.to} end className={styles.link}>{link.label}</NavLink>
                    ) )}
                </nav>
                <div className={styles.account}>
                    <span className={styles.avatar} aria-hidden="true">{user.firstName.charAt( 0 ).toUpperCase()}</span>
                    <span className={styles.name}>{`${user.firstName} ${user.lastName}`}</span>
                    <button type="button" className={`${shared.button} ${shared.secondary} ${styles.logOut}`} onClick={() => void onLogOut()}>
                        Log out
                    </button>
                </div>
            </div>
        </header>
    );
}
