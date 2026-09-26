// @ts-check

/**
 * @typedef {{ high: number; low: number; break: number | null }} MutationThresholds
 */

/**
 * Mutation testing settings for every app and package, for `stryker run` (`yarn test:mutation`).
 *
 * Stryker changes the code in small ways ("mutants": `>` to `>=`, `&&` to `||`, a removed call, `true` to
 * `false`, ...) and runs the unit tests against each change. A mutant the tests catch is "killed"; one they don't
 * catch "survives", which points at behavior no test checks, even when that line is covered. The mutation score
 * is the share of mutants killed.
 *
 * It mutates the same files coverage measures (not entry points, `*.module.ts`, test setup or specs). Reports go to
 * `reports/mutation/mutation.html`; `incremental` keeps results in `reports/stryker-incremental.json`, so later
 * runs only retest mutants in changed code.
 *
 * @example
 * // stryker.config.mjs
 * import { strykerConfig } from '@studylog/common/stryker/config';
 *
 * export default strykerConfig( { thresholds: { break: 80 } } );
 *
 * @param {{ thresholds?: Partial<MutationThresholds>; ignore?: string[]; concurrency?: number }} [options]
 */
export function strykerConfig( { thresholds = {}, ignore = [], concurrency } = {} ) {
    return {
        testRunner: 'vitest',
        plugins: [ '@stryker-mutator/vitest-runner' ],
        mutate: [
            'src/**/*.{ts,tsx}',
            '!src/**/*.{spec,test}.{ts,tsx}',
            '!src/main.{ts,tsx}',
            '!src/**/*.module.ts',
            '!src/test/**',
            ...ignore.map( ( glob ) => `!${glob}` ),
        ],
        // Only the tests that cover a mutant run against it.
        coverageAnalysis: 'perTest',
        incremental: true,
        incrementalFile: 'reports/stryker-incremental.json',
        reporters: [ 'html', 'json', 'clear-text', 'progress' ],
        htmlReporter: { fileName: 'reports/mutation/mutation.html' },
        jsonReporter: { fileName: 'reports/mutation/mutation.json' },
        thresholds: { high: 90, low: 80, break: null, ...thresholds },
        tempDirName: '.stryker-tmp',
        cleanTempDir: 'always',
        ...( concurrency && { concurrency } ),
    };
}
