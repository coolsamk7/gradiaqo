import { nodeConfig } from '@studylog/common/eslint/node';

export default nodeConfig( {
    tsconfigRootDir: import.meta.dirname,
    ignores: [ 'test-results', 'playwright-report', 'blob-report' ],
} );
