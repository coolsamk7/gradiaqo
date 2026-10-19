import { Route, Routes } from 'react-router';

import { AuthProvider } from './auth/AuthProvider.tsx';
import { RequireAuth } from './auth/RequireAuth.tsx';
import { ComingSoonPage } from './pages/coming-soon/ComingSoonPage.tsx';
import type { UpcomingPage } from './pages/coming-soon/upcoming.ts';
import { UPCOMING } from './pages/coming-soon/upcoming.ts';
import { DashboardPage } from './pages/dashboard/DashboardPage.tsx';
import { HomePage } from './pages/home/HomePage.tsx';
import { LoginPage } from './pages/login/LoginPage.tsx';
import { NotFoundPage } from './pages/not-found/NotFoundPage.tsx';
import { PathPage } from './pages/path/PathPage.tsx';
import { SessionsPage } from './pages/sessions/SessionsPage.tsx';
import { SignupPage } from './pages/signup/SignupPage.tsx';

/** The routes. The router itself is set up in main.tsx (tests use a MemoryRouter). */
export function App() {
    return (
        <AuthProvider>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/app" element={<RequireAuth><DashboardPage /></RequireAuth>} />
                <Route path="/app/sessions" element={<RequireAuth><SessionsPage /></RequireAuth>} />
                <Route path="/app/paths/:enrollmentId" element={<RequireAuth><PathPage /></RequireAuth>} />
                {( Object.keys( UPCOMING ) as UpcomingPage[] ).map( ( page ) => (
                    <Route
                        key={page}
                        path={UPCOMING[page].path}
                        element={<RequireAuth><ComingSoonPage page={page} /></RequireAuth>}
                    />
                ) )}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </AuthProvider>
    );
}
