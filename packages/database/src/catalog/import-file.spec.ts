import type { EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { LearningPath } from '../entities/learning-path.entity.js';
import { fakeManager } from '../testing/fake-manager.js';
import { CatalogFileError } from './catalog-file.js';
import { importCatalogFile } from './import-file.js';

const FILE = `
slug: dsa
title: DSA
modules:
  - title: Arrays
    topics:
      - title: Hashing
        items:
          - leetcode: two-sum
            title: Two Sum
          - type: note
            title: Hash maps
            content: Counting.
      - title: Pairs
        items:
          - leetcode: two-sum
            title: Two Sum
`;

/** Like TypeORM: a throw inside the transaction rolls it back and rethrows. */
function dataSourceOver( db = fakeManager(), failWith?: Error ) {
    const rollback = vi.fn();
    const dataSource = {
        transaction: async ( work: ( manager: EntityManager ) => Promise<unknown> ) => {
            if ( failWith ) {
                throw failWith;
            }
            try {
                return await work( db.manager );
            } catch ( error ) {
                rollback();
                throw error;
            }
        },
    };

    return { dataSource: dataSource as never, db, rollback };
}

describe( 'importCatalogFile', () => {
    it( 'imports the file and says how big it is and what changed', async () => {
        const { dataSource, db, rollback } = dataSourceOver();

        const result = await importCatalogFile( dataSource, FILE );

        expect( db.rows( LearningPath ) ).toHaveLength( 1 );
        expect( rollback ).not.toHaveBeenCalled();
        expect( result.path.slug ).toBe( 'dsa' );
        // Two Sum is in both topics but one item.
        expect( result.size ).toEqual( { modules: 1, topics: 2, items: 2 } );
        expect( result.report.path.created ).toBe( true );
        expect( result.report.items ).toEqual( { created: 2, updated: 0, linked: 3, unlinked: 0 } );
    } );

    it( 'rolls a dry run back, still reporting what it would change', async () => {
        const { dataSource, rollback } = dataSourceOver();

        const result = await importCatalogFile( dataSource, FILE, { dryRun: true } );

        expect( rollback ).toHaveBeenCalledOnce();
        expect( result.report.path.created ).toBe( true );
        expect( result.report.modules.created ).toBe( 1 );
    } );

    it( 'refuses a file with problems before touching the database, and passes database errors on', async () => {
        const { dataSource, db } = dataSourceOver();
        const transaction = vi.spyOn( dataSource, 'transaction' );

        await expect( importCatalogFile( dataSource, 'slug: x\n' ) ).rejects.toThrow( CatalogFileError );
        expect( transaction ).not.toHaveBeenCalled();
        expect( db.rows( LearningPath ) ).toHaveLength( 0 );

        const failing = dataSourceOver( fakeManager(), new Error( 'connection lost' ) ).dataSource;

        await expect( importCatalogFile( failing, FILE ) ).rejects.toThrow( 'connection lost' );
    } );
} );
