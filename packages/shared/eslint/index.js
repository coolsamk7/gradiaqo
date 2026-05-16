import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import turboPlugin from 'eslint-plugin-turbo';
import tseslint from 'typescript-eslint';
import onlyWarn from 'eslint-plugin-only-warn';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';



export const config = [
    js.configs.recommended,
    eslintConfigPrettier,
    ...tseslint.configs.recommended,
    {
        plugins: {
            turbo: turboPlugin,
        },
        rules: {
            'turbo/no-undeclared-env-vars': 'warn',
            'space-in-parens': [ 'error', 'always' ],
            'array-bracket-spacing': [ 'error', 'always' ],
            'object-curly-spacing': [ 'error', 'always' ],
        },
    },
    {
        files: [ '**/*.{jsx,tsx}' ],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
            parserOptions: {
                ecmaVersion: 'latest',
                ecmaFeatures: { jsx: true },
                sourceType: 'module',
            },
        },
        settings: { react: { version: 'detect' } },
        plugins: {
            react: reactPlugin,
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactPlugin.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
            'react/react-in-jsx-scope': 'off',
            'space-in-parens': [ 'error', 'always' ],
            'array-bracket-spacing': [ 'error', 'always' ],
            'object-curly-spacing': [ 'error', 'always' ],
        },
    },
    {
        plugins: {
            onlyWarn,
        },
    },
    {
        ignores: [ 'dist/**' ],
    },
];
