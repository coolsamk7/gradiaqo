import { join } from 'node:path';

import type { DataSourceOptions } from 'typeorm';

import { entities } from './entities/index.js';

/** Compiled migrations (`dist/migrations`), loaded by TypeORM at runtime. */
export const MIGRATIONS_DIST_DIR = join( import.meta.dirname, 'migrations' );

/** Where new migration files are written (`src/migrations`); build the package afterwards. */
export const MIGRATIONS_SOURCE_DIR = join( import.meta.dirname, '..', 'src', 'migrations' );

export const MIGRATIONS_TABLE = 'migrations';

export interface DatabaseConnectionOptions {
    url: string;
    logging?: boolean;
}

/**
 * The one database configuration shared by every app (API, CLI, workers). The schema is managed only by
 * migrations: never `synchronize`.
 */
export function createDataSourceOptions( { url, logging = false }: DatabaseConnectionOptions ): DataSourceOptions {
    return {
        type: 'postgres',
        url,
        entities,
        migrations: [ join( MIGRATIONS_DIST_DIR, '*.js' ) ],
        migrationsTableName: MIGRATIONS_TABLE,
        synchronize: false,
        logging,
    };
}
