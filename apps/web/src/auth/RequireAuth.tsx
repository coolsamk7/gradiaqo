import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { PageLoading } from '../components/PageLoading.tsx';
import { useAuth } from './auth-context.ts';

/** Only for logged-in users; others go to the login page, and come back here after logging in. */
export function RequireAuth( { children }: { children: ReactNode } ) {
    const { state } = useAuth();
    const location = useLocation();

    if ( state.status === 'loading' ) {
        return <PageLoading />;
    }
    if ( state.status === 'anonymous' ) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return children;
}
