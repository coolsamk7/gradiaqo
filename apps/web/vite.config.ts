import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig( ( { mode } ) => {
    const env = loadEnv( mode, import.meta.dirname, 'VITE_' );

    return {
        plugins: [ react() ],
        define: {
            // The API's base URL (see src/vite-env.d.ts). Set VITE_API_URL in apps/web/.env to change it.
            __API_URL__: JSON.stringify( env.VITE_API_URL ?? 'http://localhost:3000' ),
        },
        // 5173 is in the API's default CORS_ORIGINS; fail rather than silently move to another port.
        server: { port: 5173, strictPort: true },
    };
} );
