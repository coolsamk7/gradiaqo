import { BadRequestException } from '@nestjs/common';
import { AuditAction, CatalogStatus, LearningPath } from '@studylog/database';
import { fakeManager } from '@studylog/database/testing';
import type { DataSource, EntityManager } from 'typeorm';

import type { AuditService } from '../../../../src/audit/services/audit.service.js';
import { PathImportService } from '../../../../src/catalog/services/path-import.service.js';

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

/** The import's own logic is tested in @studylog/database; here, what the API adds around it. */
describe( 'PathImportService', () => {
    let db: ReturnType<typeof fakeManager>;
    let transaction: ReturnType<typeof vi.fn>;
    let audit: { record: ReturnType<typeof vi.fn> };
    let service: PathImportService;

    beforeEach( () => {
        db = fakeManager();
        // Like TypeORM, without the rollback (a dry run's rollback is tested with the importer).
        transaction = vi.fn( ( work: ( manager: EntityManager ) => Promise<unknown> ) => work( db.manager ) );
        audit = { record: vi.fn() };
        service = new PathImportService( { transaction } as unknown as DataSource, audit as unknown as AuditService );
    } );

    it( 'imports the file, says what changed, and logs who did it', async () => {
        const result = await service.import( { content: FILE }, 'admin-1' );
        const [ path ] = db.rows( LearningPath );

        expect( result ).toEqual( {
            dryRun: false,
            path: { id: path.id, slug: 'dsa', title: 'DSA', status: CatalogStatus.Draft, created: true, updated: false },
            modules: { total: 1, created: 1, updated: 0 },
            topics: { total: 2, created: 2, updated: 0 },
            items: { total: 2, created: 2, updated: 0, linked: 3, unlinked: 0 },
            notInFile: [],
            unpublishedItems: [],
        } );
        expect( audit.record ).toHaveBeenCalledWith( {
            actorId: 'admin-1',
            action: AuditAction.PathImported,
            targetId: path.id,
            targetLabel: 'DSA',
            note: '1 modules, 2 topics, 2 items: 5 new, 0 changed',
        } );
    } );

    it( 'logs nothing for a dry run, or for an import that changed nothing', async () => {
        await expect( service.import( { content: FILE, dryRun: true }, 'admin-1' ) ).resolves.toMatchObject( { dryRun: true } );
        expect( audit.record ).not.toHaveBeenCalled();

        await service.import( { content: FILE }, 'admin-1' );
        audit.record.mockClear();
        const again = await service.import( { content: FILE }, 'admin-1' );

        expect( again.path.created ).toBe( false );
        expect( audit.record ).not.toHaveBeenCalled();
    } );

    it.each( [
        [ 'a new title', ( file: string ) => file.replace( 'title: DSA', 'title: Data Structures' ) ],
        [ 'a changed module', ( file: string ) => file.replace( '  - title: Arrays\n', '  - title: Arrays\n    description: Basics.\n' ) ],
        [ 'an item taken out of a topic', ( file: string ) => file.replace( /\n {6}- title: Pairs[\s\S]*$/, '\n' ).replace( '          - type: note\n            title: Hash maps\n            content: Counting.\n', '' ) ],
    ] )( 'logs an import with %s', async ( _, edit ) => {
        await service.import( { content: FILE }, 'admin-1' );
        audit.record.mockClear();

        await service.import( { content: edit( FILE ) }, 'admin-1' );

        expect( audit.record ).toHaveBeenCalledOnce();
    } );

    it( 'answers 400 with every problem for a bad file, and passes other errors on', async () => {
        const refused = service.import( { content: 'slug: dsa\n' }, 'admin-1' );

        await expect( refused ).rejects.toBeInstanceOf( BadRequestException );
        await expect( refused ).rejects.toThrow( /^The file doesn't match the format:\n {2}\// );
        expect( transaction ).not.toHaveBeenCalled();

        transaction.mockRejectedValue( new Error( 'connection lost' ) );
        await expect( service.import( { content: FILE }, 'admin-1' ) ).rejects.toThrow( 'connection lost' );
    } );
} );
