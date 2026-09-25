import { getMetadataArgsStorage } from 'typeorm';
import { describe, expect, it } from 'vitest';

import { createDataSourceOptions, MIGRATIONS_TABLE } from './data-source.js';
import { entities } from './entities/index.js';

describe( 'createDataSourceOptions', () => {
    const options = createDataSourceOptions( { url: 'postgresql://u:p@localhost:5432/db' } );

    it( 'never lets TypeORM change the schema: migrations only', () => {
        expect( options.synchronize ).toBe( false );
        expect( options ).toMatchObject( { type: 'postgres', migrationsTableName: MIGRATIONS_TABLE } );
        expect( options.migrations ).toEqual( [ expect.stringMatching( /[/\\]migrations[/\\]\*\.js$/ ) ] );
    } );

    it( 'registers every entity class', () => {
        const declared = getMetadataArgsStorage().tables.map( ( table ) => table.target );

        expect( new Set( options.entities as unknown[] ) ).toEqual( new Set( declared ) );
        expect( entities.length ).toBe( declared.length );
    } );
} );
