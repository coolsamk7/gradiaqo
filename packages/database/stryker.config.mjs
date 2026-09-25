import { strykerConfig } from '@studylog/common/stryker/config';

// Entities are declarations and migrations are generated SQL (see vitest.config.ts).
export default strykerConfig( { ignore: [ 'src/entities/**', 'src/migrations/**' ] } );
