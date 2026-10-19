// @ts-check
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { baseConfig } from './base.js';

/**
 * For React apps built with Vite (the web app): the shared rules plus the rules of hooks and fast-refresh checks.
 *
 * @example
 * // eslint.config.mjs
 * import { reactConfig } from '@studylog/common/eslint/react';
 *
 * export default reactConfig( { tsconfigRootDir: import.meta.dirname } );
 *
 * @param {Parameters<typeof baseConfig>[0]} options
 */
export function reactConfig( options ) {
    return tseslint.config(
        ...baseConfig( options ),
        reactHooks.configs.flat['recommended-latest'],
        reactRefresh.configs.vite,
        {
            languageOptions: {
                globals: { ...globals.browser },
            },
        },
        // Fast Refresh only matters for app code; tests and their helpers may export anything.
        {
            files: [ '**/*.spec.{ts,tsx}', '**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}' ],
            rules: { 'react-refresh/only-export-components': 'off' },
        },
    );
}
