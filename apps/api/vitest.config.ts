import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig( {
    plugins: [
        // Resolves the path aliases declared in tsconfig.json, including the ones
        // added by `nest g library`.
        tsconfigPaths(),
        // Compile with SWC (using .swcrc) so tests get decorator metadata, like the app.
        swc.vite( { module: { type: 'es6' } } ),
    ],
    test: {
        globals: true,
        root: './',
        include: [ '**/*.spec.ts' ],
    },
} );
