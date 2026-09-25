import { coverageConfig } from '@studylog/common/vitest/coverage';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig( {
    // SWC emits decorator metadata, which Nest's dependency injection needs in the e2e tests.
    plugins: [ swc.vite( { module: { type: 'es6' } } ) ],
    test: {
        include: [ 'src/**/*.spec.ts', 'test/**/*.spec.ts' ],
        coverage: coverageConfig(),
    },
} );
