import { Route, Routes } from 'react-router';

import { AuthProvider } from './auth/AuthProvider.tsx';
import { RequireAuth } from './auth/RequireAuth.tsx';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage.tsx';
import { CatalogPage } from './pages/catalog/CatalogPage.tsx';
import { ComingSoonPage } from './pages/coming-soon/ComingSoonPage.tsx';
import type { UpcomingPage } from './pages/coming-soon/upcoming.ts';
import { UPCOMING } from './pages/coming-soon/upcoming.ts';
import { DashboardPage } from './pages/dashboard/DashboardPage.tsx';
import { HomePage } from './pages/home/HomePage.tsx';
import { LoginPage } from './pages/login/LoginPage.tsx';
import { MyPathsPage } from './pages/my-paths/MyPathsPage.tsx';
import { PathBuilderPage } from './pages/my-paths/PathBuilderPage.tsx';
import { NotFoundPage } from './pages/not-found/NotFoundPage.tsx';
import { PathPage } from './pages/path/PathPage.tsx';
import { PathPreviewPage } from './pages/path-preview/PathPreviewPage.tsx';
import { PathSettingsPage } from './pages/path-settings/PathSettingsPage.tsx';
import { ReadinessPage } from './pages/readiness/ReadinessPage.tsx';
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
                <Route path="/app/catalog" element={<RequireAuth><CatalogPage /></RequireAuth>} />
                <Route path="/app/catalog/:pathId" element={<RequireAuth><PathPreviewPage /></RequireAuth>} />
                <Route path="/app/paths/:enrollmentId" element={<RequireAuth><PathPage /></RequireAuth>} />
                <Route path="/app/paths/:enrollmentId/settings" element={<RequireAuth><PathSettingsPage /></RequireAuth>} />
                <Route path="/app/analytics" element={<RequireAuth><AnalyticsPage /></RequireAuth>} />
                <Route path="/app/interview-ready" element={<RequireAuth><ReadinessPage /></RequireAuth>} />
                <Route path="/app/my-paths" element={<RequireAuth><MyPathsPage /></RequireAuth>} />
                <Route path="/app/my-paths/:organizationId/:pathId" element={<RequireAuth><PathBuilderPage /></RequireAuth>} />
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
