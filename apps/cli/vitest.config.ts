import { coverageConfig } from '@studylog/common/vitest/coverage';
import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig( {
    plugins: [
        tsconfigPaths(),
        // Compile with SWC (using .swcrc) so tests get decorator metadata, like the app.
        swc.vite( { module: { type: 'es6' } } ),
    ],
    test: {
        globals: true,
        root: './',
        include: [ '**/*.spec.ts' ],
        coverage: coverageConfig(),
    },
} );
