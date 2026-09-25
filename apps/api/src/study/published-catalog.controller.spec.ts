import { NotFoundException } from '@nestjs/common';
import type { AccessTokenPayload } from '@studylog/casl';
import { CatalogStatus, Enrollment } from '@studylog/database';
import type { DataSource } from 'typeorm';

import { fakeDataSource } from '../../test/unit/fake-data-source.js';
import type { CatalogAccessService } from '../catalog/catalog-access.service.js';
import type { CatalogTreeService } from '../catalog/catalog-tree.service.js';
import type { ItemsService } from '../catalog/items.service.js';
import { PublishedCatalogController } from './published-catalog.controller.js';

const user = { sub: 'me' } as AccessTokenPayload;

describe( 'PublishedCatalogController', () => {
    const db = fakeDataSource();
    const catalogTree = { load: vi.fn() };
    const access = {
        canSeePath: vi.fn(),
        visiblePaths: vi.fn(),
        originOfPath: vi.fn().mockResolvedValue( { organization: null, createdBy: null } ),
    };
    const items = { list: vi.fn() };
    const controller = new PublishedCatalogController(
        db as unknown as DataSource,
        catalogTree as unknown as CatalogTreeService,
        access as unknown as CatalogAccessService,
        items as unknown as ItemsService,
    );

    it( 'adds the user\'s enrollment id to each visible path', async () => {
        access.visiblePaths.mockResolvedValue( [ { id: 'a', enrollmentId: null }, { id: 'b', enrollmentId: null } ] );
        db.repo( Enrollment ).find.mockResolvedValue( [ { id: 'enr-b', learningPathId: 'b' } ] );

        expect( ( await controller.list( user, {} ) ).map( ( p ) => p.enrollmentId ) ).toEqual( [ null, 'enr-b' ] );
    } );

    it( 'hides a path the user can\'t see, as not found', async () => {
        catalogTree.load.mockResolvedValue( { id: 'p', modules: [] } );
        access.canSeePath.mockResolvedValue( false );

        await expect( controller.findOne( user, 'p' ) ).rejects.toThrow( NotFoundException );
        expect( catalogTree.load ).toHaveBeenCalledWith( 'p', { publishedOnly: true } );
    } );

    it( 'searches only published global items, whatever status is asked for', async () => {
        await controller.searchItems( { status: CatalogStatus.Draft, search: 'two' } );

        expect( items.list ).toHaveBeenCalledWith( null, { status: CatalogStatus.Published, search: 'two' } );
    } );

    it( 'returns a visible path with where it comes from and the user\'s enrollment', async () => {
        catalogTree.load.mockResolvedValue( { id: 'p', modules: [] } );
        access.canSeePath.mockResolvedValue( true );
        db.repo( Enrollment ).find.mockResolvedValue( [] );

        expect( await controller.findOne( user, 'p' ) ).toEqual( {
            id: 'p', modules: [], organization: null, createdBy: null, enrollmentId: null,
        } );
    } );

    it( 'is "not found" for a missing or unpublished path', async () => {
        catalogTree.load.mockResolvedValue( null );

        await expect( controller.findOne( user, 'p' ) ).rejects.toThrow( NotFoundException );
    } );
} );
