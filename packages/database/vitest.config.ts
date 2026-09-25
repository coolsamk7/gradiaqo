import { coverageConfig } from '@studylog/common/vitest/coverage';
import { defineConfig } from 'vitest/config';

export default defineConfig( {
    test: {
        include: [ 'src/**/*.spec.ts' ],
        coverage: coverageConfig( {
            // Entities are declarations; their relation callbacks only run inside TypeORM (and the e2e tests).
            // Migrations are generated SQL, checked by `yarn cli migration:generate --check` and on a real database.
            exclude: [ 'src/entities/**', 'src/migrations/**' ],
        } ),
    },
} );
