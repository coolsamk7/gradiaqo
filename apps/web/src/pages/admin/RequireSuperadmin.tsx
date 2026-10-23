import { PlatformRole } from '@studylog/schemas/enums';
import type { ReactNode } from 'react';

import { useAuth } from '../../auth/auth-context.ts';
import { NotFoundPage } from '../not-found/NotFoundPage.tsx';

/** Admin pages, inside <RequireAuth>: only superadmins see them; for anyone else they don't exist. */
export function RequireSuperadmin( { children }: { children: ReactNode } ) {
    const { state } = useAuth();
    const { user } = ( state as Extract<typeof state, { status: 'authenticated' }> ).session;

    return user.platformRole === PlatformRole.Superadmin ? children : <NotFoundPage />;
}
