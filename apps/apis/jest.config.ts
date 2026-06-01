import type { Config } from 'jest';

const config: Config = {
    moduleFileExtensions: [ 'js', 'json', 'ts' ],
    rootDir: '.',
    testRegex: '.*\\.spec\\.ts$',
    testPathIgnorePatterns: [ '<rootDir>/dist/', '<rootDir>/node_modules/' ],
    modulePathIgnorePatterns: [ '<rootDir>/dist/' ],
    transform: {
        '^.+\\.(t|j)s$': [ 'ts-jest', {
            tsconfig: '<rootDir>/tsconfig.json',
            useESM: true,
        } ],
    },
    extensionsToTreatAsEsm: [ '.ts' ],
    moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1',
        '^typebox$': '<rootDir>/test/mocks/typebox.ts',
        '^typebox/value$': '<rootDir>/test/mocks/typebox-value.ts',
        '^@gradiaqo/nestjs-database/entities$': '<rootDir>/../../packages/nestjs/database/dist/entities.cjs',
        '^@gradiaqo/nestjs-keycloak-admin$': '<rootDir>/test/mocks/keycloak-admin.ts',
        '^@gradiaqo/nestjs-shared$': '<rootDir>/../../packages/nestjs/shared/dist/index.js',
    },
    testEnvironment: 'node',
};

export default config;
