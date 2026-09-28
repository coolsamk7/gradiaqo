import { Route, Routes } from 'react-router';

import { AuthProvider } from './auth/AuthProvider.tsx';
import { RequireAuth } from './auth/RequireAuth.tsx';
import { AppHomePage } from './pages/app/AppHomePage.tsx';
import { HomePage } from './pages/home/HomePage.tsx';
import { LoginPage } from './pages/login/LoginPage.tsx';
import { NotFoundPage } from './pages/not-found/NotFoundPage.tsx';
import { SignupPage } from './pages/signup/SignupPage.tsx';

/** The routes. The router itself is set up in main.tsx (tests use a MemoryRouter). */
export function App() {
    return (
        <AuthProvider>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/app" element={<RequireAuth><AppHomePage /></RequireAuth>} />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </AuthProvider>
    );
}
