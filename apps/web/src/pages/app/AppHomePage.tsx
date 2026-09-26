import { useNavigate } from 'react-router';

import { useAuth } from '../../auth/auth-context.ts';
import { Logo } from '../../components/Logo.tsx';
import shared from '../../styles/shared.module.css';
import styles from './AppHomePage.module.css';

/** Where users land after logging in. A placeholder until the dashboard is built. */
export function AppHomePage() {
    const { state, logOut } = useAuth();
    const navigate = useNavigate();
    // Only rendered inside <RequireAuth>, so there is a session.
    const { user } = ( state as Extract<typeof state, { status: 'authenticated' }> ).session;

    // Leave this page first: once the session is gone, it would send the user to the login page instead.
    const onLogOut = async () => {
        void navigate( '/', { replace: true } );
        await logOut();
    };

    return (
        <main className={styles.page}>
            <Logo />
            <h1 className={styles.title}>{`Welcome back, ${user.firstName}!`}</h1>
            <p className={styles.text}>Your dashboard is on its way. For now, you&apos;re logged in.</p>
            <button type="button" className={`${shared.button} ${shared.secondary}`} onClick={() => void onLogOut()}>
                Log out
            </button>
        </main>
    );
}
