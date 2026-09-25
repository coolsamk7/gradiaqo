import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CatalogStatus, LearningModule } from '@studylog/database';
import type { DataSource } from 'typeorm';
import { IsNull, QueryFailedError } from 'typeorm';

import type { FakeDataSource } from '../../test/unit/fake-data-source.js';
import { fakeDataSource } from '../../test/unit/fake-data-source.js';
import type { LearningPathsService } from './learning-paths.service.js';
import { ModulesService } from './modules.service.js';

describe( 'ModulesService', () => {
    let db: FakeDataSource;
    let paths: { findOrFail: ReturnType<typeof vi.fn> };
    let service: ModulesService;

    beforeEach( () => {
        db = fakeDataSource();
        paths = { findOrFail: vi.fn().mockResolvedValue( { id: 'dsa' } ) };
        service = new ModulesService( db as unknown as DataSource, paths as unknown as LearningPathsService );
    } );

    describe( 'create', () => {
        it( 'checks the path belongs to the catalog, then adds the module at the end', async () => {
            db.repo( LearningModule ).maximum.mockResolvedValue( 2 );

            await service.create( 'org-1', 'dsa', { title: 'Arrays & Hashing' } );

            expect( paths.findOrFail ).toHaveBeenCalledWith( 'org-1', 'dsa' );
            expect( db.repo( LearningModule ).save ).toHaveBeenCalledWith( expect.objectContaining( {
                learningPathId: 'dsa',
                slug: 'arrays-hashing',
                position: 3,
                status: CatalogStatus.Published,
            } ) );
        } );

        it( 'reports a slug already used in the path as a conflict', async () => {
            db.repo( LearningModule ).save.mockRejectedValue( new QueryFailedError( 'INSERT', [], Object.assign( new Error(), { code: '23505' } ) ) );

            await expect( service.create( null, 'dsa', { title: 'Arrays' } ) ).rejects.toThrow( 'already has a module with slug "arrays"' );
        } );
    } );

    it( 'only finds modules under a path of the given catalog', async () => {
        await expect( service.findOrFail( null, 'm' ) ).rejects.toThrow( NotFoundException );
        expect( db.repo( LearningModule ).findOneBy ).toHaveBeenCalledWith( { id: 'm', learningPath: { organizationId: IsNull() } } );
    } );

    it( 'remove follows the catalog\'s delete rule', async () => {
        db.repo( LearningModule ).findOneBy.mockResolvedValue( { id: 'm', status: CatalogStatus.Published } );

        await expect( service.remove( null, 'm' ) ).rejects.toThrow( ConflictException );
        await service.remove( 'org-1', 'm' );

        expect( db.repo( LearningModule ).remove ).toHaveBeenCalledOnce();
    } );

    it( 'reorder needs every module of the path exactly once', async () => {
        db.repo( LearningModule ).find.mockResolvedValueOnce( [ { id: 'a' }, { id: 'b' } ] );
        await expect( service.reorder( null, 'dsa', [ 'a' ] ) ).rejects.toThrow( BadRequestException );

        db.repo( LearningModule ).find.mockResolvedValueOnce( [ { id: 'a' }, { id: 'b' } ] );
        await service.reorder( null, 'dsa', [ 'b', 'a' ] );
        expect( db.query ).toHaveBeenCalledWith( expect.stringContaining( 'UPDATE "modules"' ), [ [ 'b', 'a' ], 'dsa' ] );
    } );

    it( 'update saves the changes, and a taken slug is a conflict', async () => {
        db.repo( LearningModule ).findOneBy.mockResolvedValue( { id: 'm', slug: 'arrays', title: 'Arrays' } );

        await service.update( null, 'm', { title: 'Arrays & Hashing' } );
        expect( db.repo( LearningModule ).save ).toHaveBeenCalledWith( expect.objectContaining( { title: 'Arrays & Hashing', slug: 'arrays' } ) );

        db.repo( LearningModule ).save.mockRejectedValue( new QueryFailedError( 'UPDATE', [], Object.assign( new Error(), { code: '23505' } ) ) );
        await expect( service.update( null, 'm', { slug: 'searching' } ) ).rejects.toThrow( 'slug "searching"' );
    } );
} );
