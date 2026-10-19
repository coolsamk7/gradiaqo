import { defineConfig, devices } from '@playwright/test';

import { API_PORT, API_URL, DATABASE_URL, WEB_PORT, WEB_URL } from './settings.ts';

const CI = Boolean( process.env.CI );

export default defineConfig( {
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: CI,
    retries: CI ? 2 : 0,
    reporter: CI ? [ [ 'github' ], [ 'html', { open: 'never' } ] ] : [ [ 'list' ], [ 'html', { open: 'never' } ] ],
    use: {
        baseURL: WEB_URL,
        // Dates are shown in the browser's time zone: the same one everywhere, like the unit tests.
        timezoneId: 'UTC',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [ { name: 'chromium', use: { ...devices['Desktop Chrome'] } } ],
    webServer: [
        {
            // A fresh test database, then the built API (turbo builds it first, see `yarn test:e2e`).
            command: 'node prepare-db.ts && yarn workspace @studylog/api start:prod',
            url: `${API_URL}/health`,
            timeout: 120_000,
            stdout: 'ignore',
            stderr: 'pipe',
            env: {
                NODE_ENV: 'test',
                PORT: String( API_PORT ),
                DATABASE_URL,
                JWT_SECRET: 'e2e-only-secret-that-is-long-enough-to-pass-validation',
                CORS_ORIGINS: WEB_URL,
                COOKIE_SECURE: 'false',
                SWAGGER_ENABLED: 'false',
                // Tests log in far more often than people do; everything else stays as in production.
                RATE_LIMITS_ENABLED: 'false',
                LOG_LEVEL: 'warn',
            },
        },
        {
            command: `yarn workspace @studylog/web dev --port ${WEB_PORT}`,
            url: WEB_URL,
            timeout: 60_000,
            env: { VITE_API_URL: API_URL },
        },
    ],
} );
