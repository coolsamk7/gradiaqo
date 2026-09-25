// @ts-check

/**
 * @typedef {{ lines?: number; branches?: number; functions?: number; statements?: number }} Thresholds
 */

/**
 * Coverage settings for every app and package, for `vitest run --coverage` (`yarn test:cov`).
 *
 * Reports go to `coverage/`: `index.html` to browse, `lcov.info` for CI tools and editors, and
 * `coverage-final.json` (per line) and
 * `coverage-summary.json`, which `yarn test:cov` at the root combines into one table.
 *
 * Wiring that unit tests don't exercise is left out: app entry points (`main.ts`) and Nest modules (`*.module.ts`). Everything else must be fully covered: the run fails below 100% on any metric, so new code
 * comes with its tests. Pass `thresholds` only to relax this for a package, with a reason.
 *
 * @example
 * // vitest.config.ts
 * import { coverageConfig } from '@studylog/common/vitest/coverage';
 *
 * export default defineConfig( { test: { coverage: coverageConfig() } } );
 *
 * @param {{ thresholds?: Thresholds; exclude?: string[] }} [options]
 */
export function coverageConfig( { thresholds = { lines: 100, branches: 100, functions: 100, statements: 100 }, exclude = [] } = {} ) {
    return {
        provider: /** @type {const} */ ( 'v8' ),
        include: [ 'src/**/*.ts' ],
        exclude: [
            'src/**/*.spec.ts',
            'src/**/*.test.ts',
            'src/main.ts',
            'src/**/*.module.ts',
            ...exclude,
        ],
        reporter: [ 'text-summary', 'html', 'lcov', 'json', 'json-summary' ],
        reportsDirectory: './coverage',
        thresholds,
    };
}
