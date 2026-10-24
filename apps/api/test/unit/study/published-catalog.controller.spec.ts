import { NotFoundException } from '@nestjs/common';
import type { AccessTokenPayload } from '@studylog/casl';
import { CatalogStatus, Enrollment } from '@studylog/database';
import type { DataSource } from 'typeorm';

import type { CatalogAccessService } from '../../../src/catalog/catalog-access.service.js';
import type { CatalogTreeService } from '../../../src/catalog/catalog-tree.service.js';
import type { ItemsService } from '../../../src/catalog/items.service.js';
import { PublishedCatalogController } from '../../../src/study/published-catalog.controller.js';
import { fakeDataSource } from '../fake-data-source.js';

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

    it( 'adds the user\'s enrollment id and what each visible path contains', async () => {
        access.visiblePaths.mockResolvedValue( [ { id: 'a', enrollmentId: null }, { id: 'b', enrollmentId: null } ] );
        db.repo( Enrollment ).find.mockResolvedValue( [ { id: 'enr-b', learningPathId: 'b' } ] );
        db.query.mockResolvedValueOnce( [ { pathId: 'a', modules: 4, items: 25, estimatedMinutes: 720 } ] );

        const paths = await controller.list( user, {} );

        expect( paths.map( ( p ) => p.enrollmentId ) ).toEqual( [ null, 'enr-b' ] );
        // A path with nothing published yet has no row.
        expect( paths.map( ( p ) => p.contents ) ).toEqual( [
            { modules: 4, items: 25, estimatedMinutes: 720 },
            { modules: 0, items: 0, estimatedMinutes: 0 },
        ] );
        expect( db.query ).toHaveBeenCalledWith( expect.stringContaining( 'ANY( $1 )' ), [ [ 'a', 'b' ] ] );
    } );

    it( 'doesn\'t count contents when no path is visible', async () => {
        access.visiblePaths.mockResolvedValue( [] );
        db.query.mockClear();

        await expect( controller.list( user, { search: 'nothing' } ) ).resolves.toEqual( [] );
        expect( db.query ).not.toHaveBeenCalled();
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
            contents: { modules: 0, items: 0, estimatedMinutes: 0 },
        } );
    } );

    it( 'counts a path\'s modules and items, each item once, from its tree', async () => {
        const item = ( id: string, estimatedMinutes: number | null ) => ( { id, estimatedMinutes } );

        catalogTree.load.mockResolvedValue( { id: 'p', modules: [
            { topics: [ { items: [ item( 'a', 15 ), item( 'b', null ) ] }, { items: [ item( 'a', 15 ) ] } ] },
            { topics: [ { items: [ item( 'c', 30 ) ] } ] },
        ] } );
        access.canSeePath.mockResolvedValue( true );

        expect( ( await controller.findOne( user, 'p' ) ).contents ).toEqual( { modules: 2, items: 3, estimatedMinutes: 45 } );
    } );

    it( 'is "not found" for a missing or unpublished path', async () => {
        catalogTree.load.mockResolvedValue( null );

        await expect( controller.findOne( user, 'p' ) ).rejects.toThrow( NotFoundException );
    } );
} );
