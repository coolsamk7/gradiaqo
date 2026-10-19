import { coverageConfig } from '@studylog/common/vitest/coverage';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig( {
    plugins: [ react() ],
    // Tests never talk to a real API; see src/test/api.ts.
    define: { __API_URL__: JSON.stringify( 'http://api.test' ) },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: [ './src/test/setup.ts' ],
        // Dates are shown in the browser's time zone: the same one everywhere, so tests don't depend on the machine.
        env: { TZ: 'UTC' },
        include: [ 'src/**/*.spec.{ts,tsx}' ],
        coverage: coverageConfig(),
    },
} );
