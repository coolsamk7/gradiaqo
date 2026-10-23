import { useLocation } from 'react-router';

/** What can be passed in the router state when linking to the login or signup page. */
export interface AuthPageState {
    /** Where to go after logging in or signing up; default /app. */
    from?: string;
    /** Prefills the email, e.g. after trying to sign up with an email that already has an account. */
    email?: string;
    /** The session ended while using the app; the login page says so. */
    expired?: boolean;
    /** Good news for the login page to show, e.g. that the password was changed. */
    notice?: string;
}

export function useAuthPageState(): AuthPageState {
    const { state } = useLocation() as { state: AuthPageState | null };

    return state ?? {};
}
