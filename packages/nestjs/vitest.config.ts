import { coverageConfig } from '@studylog/common/vitest/coverage';
import { defineConfig } from 'vitest/config';

export default defineConfig( {
    test: {
        include: [ 'src/**/*.spec.ts' ],
        coverage: coverageConfig(),
    },
} );
