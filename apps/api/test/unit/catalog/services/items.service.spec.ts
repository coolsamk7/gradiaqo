import { TypeboxValidationException } from '@gradiaqo/nestjs-typebox';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuditAction, CatalogStatus, Item, ItemType } from '@studylog/database';
import type { Repository } from 'typeorm';

import type { AuditService } from '../../../../src/audit/services/audit.service.js';
import { ItemsService } from '../../../../src/catalog/services/items.service.js';
import type { FakeDataSource } from '../../fake-data-source.js';
import { fakeDataSource, fakeQueryBuilder } from '../../fake-data-source.js';

const problem = { type: ItemType.Problem, title: 'Two Sum', details: { url: 'https://leetcode.com/problems/two-sum' } };

describe( 'ItemsService', () => {
    let db: FakeDataSource;
    let service: ItemsService;
    let audit: { record: ReturnType<typeof vi.fn> };

    beforeEach( () => {
        db = fakeDataSource();
        audit = { record: vi.fn() };
        service = new ItemsService( db.repo( Item ) as unknown as Repository<Item>, audit as unknown as AuditService );
    } );

    const saved = () => db.repo( Item ).save.mock.calls[0][0] as Item;

    describe( 'create', () => {
        it( 'checks details against the item type and reports errors under /details', async () => {
            const error = await service.create( null, { ...problem, details: { platform: 'leetcode', extra: 1 } }, 'admin' )
                .catch( ( err: unknown ) => err );

            expect( error ).toBeInstanceOf( TypeboxValidationException );
            expect( ( error as TypeboxValidationException ).issues.map( ( issue ) => issue.path ).sort() )
                .toEqual( [ '/details/extra', '/details/url' ] );
            expect( db.repo( Item ).save ).not.toHaveBeenCalled();
        } );

        it( 'starts global items as drafts and organization items as published', async () => {
            await service.create( null, problem, 'admin' );
            await service.create( 'org-1', problem, 'sam' );

            expect( db.repo( Item ).save.mock.calls.map( ( [ item ] ) => ( item as Item ).status ) )
                .toEqual( [ CatalogStatus.Draft, CatalogStatus.Published ] );
            expect( ( db.repo( Item ).save.mock.calls[1][0] as Item ).organizationId ).toBe( 'org-1' );
        } );
    } );

    describe( 'update', () => {
        it( 'checks new details against the item\'s existing type', async () => {
            db.repo( Item ).findOneBy.mockResolvedValue( { id: 'i', type: ItemType.Video, details: { url: 'https://y.t' } } );

            await expect( service.update( null, 'i', { details: { content: 'not a video' } }, 'admin' ) )
                .rejects.toThrow( TypeboxValidationException );

            await service.update( null, 'i', { details: { url: 'https://youtu.be/x', durationMinutes: 10 } }, 'admin' );
            expect( saved().details ).toEqual( { url: 'https://youtu.be/x', durationMinutes: 10 } );
        } );
    } );

    it( 'remove only deletes drafts from the global catalog', async () => {
        db.repo( Item ).findOneBy.mockResolvedValue( { id: 'i', status: CatalogStatus.Archived } );

        await expect( service.remove( null, 'i', 'admin' ) ).rejects.toThrow( ConflictException );
        await service.remove( 'org-1', 'i', 'admin' );

        expect( db.repo( Item ).remove ).toHaveBeenCalledOnce();
    } );

    describe( 'list', () => {
        it( 'says how many topics use each item, without asking when there are none', async () => {
            db.repo( Item ).createQueryBuilder.mockReturnValue( fakeQueryBuilder( [ { id: 'a' }, { id: 'b' } ] ) );
            db.repo( Item ).query.mockResolvedValue( [ { itemId: 'a', topics: 4 } ] );

            const page = await service.list( null, {} );

            expect( page.items ).toEqual( [ { id: 'a', topicCount: 4 }, { id: 'b', topicCount: 0 } ] );
            expect( db.repo( Item ).query ).toHaveBeenCalledWith( expect.stringContaining( 'FROM topic_items' ), [ [ 'a', 'b' ] ] );

            db.repo( Item ).query.mockClear();
            db.repo( Item ).createQueryBuilder.mockReturnValue( fakeQueryBuilder( [] ) );
            expect( ( await service.list( null, {} ) ).items ).toEqual( [] );
            expect( db.repo( Item ).query ).not.toHaveBeenCalled();
        } );

        it( 'filters by catalog and escapes LIKE wildcards in the search', async () => {
            const query = fakeQueryBuilder( [ { id: 'i' } ], 7 );

            db.repo( Item ).createQueryBuilder.mockReturnValue( query );

            const page = await service.list( 'org-1', { search: '100%_done', tag: 'array', limit: 5, offset: 10 } );

            expect( page ).toEqual( { items: [ { id: 'i', topicCount: 0 } ], total: 7 } );
            expect( query.where ).toHaveBeenCalledWith( 'item.organization_id = :owner', { owner: 'org-1' } );
            expect( query.andWhere ).toHaveBeenCalledWith( 'item.title ILIKE :search', { search: '%100\\%\\_done%' } );
            expect( query.andWhere ).toHaveBeenCalledWith( ':tag = ANY( item.tags )', { tag: 'array' } );
            expect( query.take ).toHaveBeenCalledWith( 5 );
            expect( query.skip ).toHaveBeenCalledWith( 10 );
        } );

        it( 'lists global items with organization_id IS NULL', async () => {
            const query = fakeQueryBuilder();

            db.repo( Item ).createQueryBuilder.mockReturnValue( query );
            await service.list( null, {} );

            expect( query.where ).toHaveBeenCalledWith( 'item.organization_id IS NULL', { owner: null } );
        } );
    } );

    it( 'list filters by type and status when given', async () => {
        const query = fakeQueryBuilder();

        db.repo( Item ).createQueryBuilder.mockReturnValue( query );
        await service.list( null, { type: ItemType.Video, status: CatalogStatus.Published } );

        expect( query.andWhere ).toHaveBeenCalledWith( 'item.type = :type', { type: ItemType.Video } );
        expect( query.andWhere ).toHaveBeenCalledWith( 'item.status = :status', { status: CatalogStatus.Published } );
    } );

    it( 'findOrFail only finds items of the catalog', async () => {
        await expect( service.findOrFail( 'org-1', 'i' ) ).rejects.toThrow( NotFoundException );
        expect( db.repo( Item ).findOneBy ).toHaveBeenCalledWith( { id: 'i', organizationId: 'org-1' } );
    } );

    describe( 'audit log', () => {
        it( 'records a status change or deletion in the global catalog, by whom', async () => {
            db.repo( Item ).findOneBy.mockResolvedValue( { id: 'i', title: 'Two Sum', type: ItemType.Note, status: CatalogStatus.Draft } );
            db.repo( Item ).save.mockImplementation( ( row: Item ) => Promise.resolve( row ) );

            await service.update( null, 'i', { status: CatalogStatus.Published }, 'admin' );
            expect( audit.record ).toHaveBeenCalledWith( { actorId: 'admin', action: AuditAction.ItemPublished, targetId: 'i', targetLabel: 'Two Sum' } );

            db.repo( Item ).findOneBy.mockResolvedValue( { id: 'i', title: 'Two Sum', status: CatalogStatus.Draft } );
            await service.remove( null, 'i', 'admin' );
            expect( audit.record ).toHaveBeenLastCalledWith( { actorId: 'admin', action: AuditAction.ItemDeleted, targetId: 'i', targetLabel: 'Two Sum' } );
        } );

        it( 'records nothing for other changes, or for an organization\'s own items', async () => {
            db.repo( Item ).save.mockImplementation( ( row: Item ) => Promise.resolve( row ) );
            db.repo( Item ).findOneBy.mockResolvedValue( { id: 'i', title: 'Two Sum', type: ItemType.Note, status: CatalogStatus.Draft } );
            await service.update( null, 'i', { title: 'Two Sum II', status: CatalogStatus.Draft }, 'admin' );

            db.repo( Item ).findOneBy.mockResolvedValue( { id: 'i', title: 'Two Sum', type: ItemType.Note, status: CatalogStatus.Draft } );
            await service.update( 'org-1', 'i', { status: CatalogStatus.Archived }, 'admin' );
            await service.remove( 'org-1', 'i', 'admin' );

            expect( audit.record ).not.toHaveBeenCalled();
        } );
    } );

    it( 'update without details keeps them', async () => {
        db.repo( Item ).findOneBy.mockResolvedValue( { id: 'i', type: ItemType.Note, details: { content: 'x' } } );

        await service.update( null, 'i', { title: 'Renamed' }, 'admin' );

        expect( saved() ).toMatchObject( { title: 'Renamed', details: { content: 'x' } } );
    } );
} );
