// @ts-check
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { baseConfig } from './base.js';

/**
 * For Node.js code: the API and backend packages.
 *
 * @example
 * // eslint.config.mjs
 * import { nodeConfig } from '@studylog/common/eslint/node';
 *
 * export default nodeConfig( { tsconfigRootDir: import.meta.dirname } );
 *
 * @param {Parameters<typeof baseConfig>[0]} options
 */
export function nodeConfig( options ) {
    return tseslint.config(
        ...baseConfig( options ),
        {
            languageOptions: {
                globals: { ...globals.node },
            },
        },
    );
}
