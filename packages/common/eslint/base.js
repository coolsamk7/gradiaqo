// @ts-check
import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

/**
 * Shared rules for every StudyLog app and package: type-aware TypeScript checks,
 * formatting (4-space indent, spaces inside brackets) and import sorting.
 *
 * @param {object} options
 * @param {string} options.tsconfigRootDir Pass `import.meta.dirname` from the consuming eslint.config.mjs.
 * @param {string[]} [options.ignores] Extra paths to ignore, on top of dist/coverage.
 */
export function baseConfig( { tsconfigRootDir, ignores = [] } ) {
    return tseslint.config(
        { ignores: [ '**/dist', '**/coverage', '**/eslint.config.mjs', ...ignores ] },
        eslint.configs.recommended,
        tseslint.configs.recommendedTypeChecked,
        tseslint.configs.stylisticTypeChecked,
        {
            languageOptions: {
                parserOptions: {
                    projectService: true,
                    tsconfigRootDir,
                },
            },
        },

        // ---------- Formatting (`yarn lint:fix` applies all of these) ----------
        stylistic.configs.customize( {
            indent: 4,
            quotes: 'single',
            semi: true,
            commaDangle: 'always-multiline',
            braceStyle: '1tbs',
            arrowParens: true,
            blockSpacing: true,
            quoteProps: 'as-needed',
            jsx: true,
        } ),
        {
            rules: {
                // Spaces inside brackets: foo( a, b ), [ 1, 2 ], { a: 1 }
                '@stylistic/space-in-parens': [ 'error', 'always' ],
                '@stylistic/array-bracket-spacing': [ 'error', 'always' ],
                '@stylistic/object-curly-spacing': [ 'error', 'always' ],
                '@stylistic/computed-property-spacing': [ 'error', 'never' ],
                '@stylistic/template-curly-spacing': [ 'error', 'never' ],

                // Spaces around keywords, operators, commas, colons and arrows
                '@stylistic/keyword-spacing': [ 'error', { before: true, after: true } ],
                '@stylistic/space-infix-ops': 'error',
                '@stylistic/space-unary-ops': [ 'error', { words: true, nonwords: false } ],
                '@stylistic/comma-spacing': [ 'error', { before: false, after: true } ],
                '@stylistic/key-spacing': [ 'error', { beforeColon: false, afterColon: true } ],
                '@stylistic/arrow-spacing': [ 'error', { before: true, after: true } ],
                '@stylistic/type-annotation-spacing': 'error',
                '@stylistic/space-before-blocks': [ 'error', 'always' ],
                '@stylistic/space-before-function-paren': [
                    'error',
                    { anonymous: 'always', named: 'never', asyncArrow: 'always' },
                ],
                '@stylistic/no-multi-spaces': 'error',

                // Line length and line breaks
                '@stylistic/max-len': [
                    'warn',
                    {
                        code: 120,
                        ignoreUrls: true,
                        ignoreStrings: true,
                        ignoreTemplateLiterals: true,
                        ignoreRegExpLiterals: true,
                        ignoreComments: true,
                    },
                ],
                '@stylistic/max-statements-per-line': [ 'error', { max: 1 } ],
                '@stylistic/object-curly-newline': [ 'error', { consistent: true } ],
                '@stylistic/array-bracket-newline': [ 'error', 'consistent' ],
                '@stylistic/function-call-argument-newline': [ 'error', 'consistent' ],
                '@stylistic/function-paren-newline': [ 'error', 'multiline-arguments' ],
                '@stylistic/operator-linebreak': [ 'error', 'before', { overrides: { '=': 'after' } } ],
                '@stylistic/multiline-ternary': [ 'error', 'always-multiline' ],
                '@stylistic/dot-location': [ 'error', 'property' ],
                '@stylistic/newline-per-chained-call': [ 'error', { ignoreChainWithDepth: 3 } ],

                // Blank lines
                '@stylistic/no-multiple-empty-lines': [ 'error', { max: 1, maxBOF: 0, maxEOF: 0 } ],
                '@stylistic/padded-blocks': [ 'error', 'never' ],
                '@stylistic/lines-between-class-members': [
                    'error',
                    'always',
                    { exceptAfterSingleLine: true },
                ],
                '@stylistic/padding-line-between-statements': [
                    'error',
                    // Blank line before every return, and after a block of imports / variable declarations.
                    { blankLine: 'always', prev: '*', next: 'return' },
                    { blankLine: 'always', prev: 'import', next: '*' },
                    { blankLine: 'any', prev: 'import', next: 'import' },
                    { blankLine: 'always', prev: [ 'const', 'let' ], next: '*' },
                    { blankLine: 'any', prev: [ 'const', 'let' ], next: [ 'const', 'let' ] },
                ],
                '@stylistic/eol-last': [ 'error', 'always' ],
                '@stylistic/no-trailing-spaces': 'error',
                '@stylistic/linebreak-style': [ 'error', 'unix' ],

                // TypeScript types
                '@stylistic/member-delimiter-style': [
                    'error',
                    {
                        multiline: { delimiter: 'semi', requireLast: true },
                        singleline: { delimiter: 'semi', requireLast: false },
                    },
                ],
            },
        },

        // ---------- Code quality ----------
        {
            plugins: { 'simple-import-sort': simpleImportSort },
            rules: {
                // Imports and exports are sorted automatically by `yarn lint:fix`.
                'simple-import-sort/imports': 'error',
                'simple-import-sort/exports': 'error',

                '@typescript-eslint/no-floating-promises': 'error',
                '@typescript-eslint/consistent-type-imports': [
                    'error',
                    // Decorator-based code (Nest, TypeORM) keeps real imports for classes it needs at runtime.
                    { prefer: 'type-imports', fixStyle: 'separate-type-imports', disallowTypeAnnotations: false },
                ],
                '@typescript-eslint/no-unused-vars': [
                    'error',
                    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
                ],
                '@typescript-eslint/no-explicit-any': 'warn',
                '@typescript-eslint/explicit-member-accessibility': [
                    'error',
                    { accessibility: 'no-public' },
                ],
                '@typescript-eslint/member-ordering': 'error',
                '@typescript-eslint/naming-convention': [
                    'error',
                    { selector: 'default', format: [ 'camelCase' ], leadingUnderscore: 'allow' },
                    {
                        selector: 'variable',
                        format: [ 'camelCase', 'UPPER_CASE', 'PascalCase' ],
                        leadingUnderscore: 'allow',
                    },
                    // `_` alone marks an intentionally unused value, e.g. `const { secret: _, ...rest } = obj`.
                    { selector: 'variable', filter: { regex: '^_$', match: true }, format: null },
                    // PascalCase functions are React components.
                    { selector: 'function', format: [ 'camelCase', 'PascalCase' ] },
                    { selector: 'typeLike', format: [ 'PascalCase' ] },
                    { selector: 'enumMember', format: [ 'PascalCase', 'UPPER_CASE' ] },
                    // Allow keys like 'Content-Type' or snake_case DB/HTTP names in object literals.
                    { selector: [ 'objectLiteralProperty', 'typeProperty' ], format: null },
                    { selector: 'import', format: null },
                ],
                eqeqeq: [ 'error', 'always' ],
                curly: [ 'error', 'all' ],
                'no-console': 'warn',
                'no-else-return': [ 'error', { allowElseIf: false } ],
                'no-nested-ternary': 'error',
                'no-useless-return': 'error',
                'prefer-const': 'error',
                'prefer-template': 'error',
                'object-shorthand': 'error',
                'no-param-reassign': 'error',
            },
        },

        // ---------- Tests ----------
        {
            files: [ '**/*.spec.ts', '**/*.test.ts', '**/*.spec.tsx', '**/*.test.tsx', 'test/**/*.ts' ],
            rules: {
                '@typescript-eslint/no-unsafe-argument': 'off',
                '@typescript-eslint/no-unsafe-assignment': 'off',
                '@typescript-eslint/no-unsafe-member-access': 'off',
            },
        },
    );
}
