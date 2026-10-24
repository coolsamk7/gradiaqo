import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CatalogStatus, Item, Topic, TopicItem } from '@studylog/database';
import type { DataSource } from 'typeorm';
import { FindOperator, QueryFailedError } from 'typeorm';

import type { ModulesService } from '../../../../src/catalog/services/modules.service.js';
import { TopicsService } from '../../../../src/catalog/services/topics.service.js';
import type { FakeDataSource } from '../../fake-data-source.js';
import { fakeDataSource } from '../../fake-data-source.js';

const ORG = 'org-1';
const isNullOperator = ( value: unknown ) => value instanceof FindOperator && value.type === 'isNull';

describe( 'TopicsService', () => {
    let db: FakeDataSource;
    let service: TopicsService;

    beforeEach( () => {
        db = fakeDataSource();
        db.repo( Topic ).findOneBy.mockResolvedValue( { id: 'topic-1' } );
        db.repo( TopicItem ).findOneOrFail.mockResolvedValue( { item: { id: 'item-1' }, position: 1, isOptional: false } );
        service = new TopicsService( db as unknown as DataSource, {} as ModulesService );
    } );

    it( 'only finds topics under a path of the given catalog', async () => {
        db.repo( Topic ).findOneBy.mockResolvedValue( null );

        await expect( service.findOrFail( ORG, 'topic-1' ) ).rejects.toThrow( NotFoundException );
        expect( db.repo( Topic ).findOneBy ).toHaveBeenCalledWith( {
            id: 'topic-1',
            module: { learningPath: { organizationId: ORG } },
        } );
    } );

    describe( 'linkItem', () => {
        const items = () => db.repo( Item ).existsBy;

        it( 'links an item of the same catalog at the end of the topic', async () => {
            items().mockImplementation( ( where: { organizationId: unknown } ) =>
                Promise.resolve( where.organizationId === ORG ) );
            db.repo( TopicItem ).maximum.mockResolvedValue( 2 );

            await service.linkItem( ORG, 'topic-1', 'item-1', {} );

            expect( db.repo( TopicItem ).insert ).toHaveBeenCalledWith( { topicId: 'topic-1', itemId: 'item-1', isOptional: false, position: 3 } );
        } );

        it( 'lets an organization reuse a published global item', async () => {
            // Only the "global and published" lookup finds it.
            items().mockImplementation( ( where: { organizationId: unknown; status?: CatalogStatus } ) =>
                Promise.resolve( where.status === CatalogStatus.Published && isNullOperator( where.organizationId ) ) );

            await service.linkItem( ORG, 'topic-1', 'item-1', {} );

            expect( db.repo( TopicItem ).insert ).toHaveBeenCalled();
        } );

        it( 'refuses another organization\'s item, a draft global item, and org items in the global catalog', async () => {
            await expect( service.linkItem( ORG, 'topic-1', 'item-1', {} ) ).rejects.toThrow( NotFoundException );
            await expect( service.linkItem( null, 'topic-1', 'item-1', {} ) ).rejects.toThrow( NotFoundException );

            // The global catalog never checks for global items as a fallback: only its own.
            expect( items() ).toHaveBeenCalledTimes( 3 );
            expect( db.repo( TopicItem ).insert ).not.toHaveBeenCalled();
        } );

        it( 'linking again only updates isOptional and keeps the position', async () => {
            items().mockResolvedValue( true );
            db.repo( TopicItem ).findOneBy.mockResolvedValue( { topicId: 'topic-1', itemId: 'item-1', position: 1 } );

            await service.linkItem( ORG, 'topic-1', 'item-1', { isOptional: true } );
            await service.linkItem( ORG, 'topic-1', 'item-1', {} );

            expect( db.repo( TopicItem ).insert ).not.toHaveBeenCalled();
            expect( db.repo( TopicItem ).update ).toHaveBeenCalledOnce();
            expect( db.repo( TopicItem ).update ).toHaveBeenCalledWith( { topicId: 'topic-1', itemId: 'item-1' }, { isOptional: true } );
        } );
    } );

    it( 'unlinkItem checks the topic belongs to the catalog first', async () => {
        db.repo( Topic ).findOneBy.mockResolvedValue( null );

        await expect( service.unlinkItem( ORG, 'topic-1', 'item-1' ) ).rejects.toThrow( NotFoundException );
        expect( db.repo( TopicItem ).delete ).not.toHaveBeenCalled();
    } );

    describe( 'topic CRUD', () => {
        const modules = { findOrFail: vi.fn().mockResolvedValue( { id: 'm' } ) };
        const unique = new QueryFailedError( 'INSERT', [], Object.assign( new Error(), { code: '23505' } ) );

        beforeEach( () => {
            service = new TopicsService( db as unknown as DataSource, modules as unknown as ModulesService );
        } );

        it( 'create checks the module, then adds the topic at the end with a slug from the title', async () => {
            db.repo( Topic ).maximum.mockResolvedValue( 1 );

            await service.create( ORG, 'm', { title: 'Two Pointers' } );

            expect( modules.findOrFail ).toHaveBeenCalledWith( ORG, 'm' );
            expect( db.repo( Topic ).save ).toHaveBeenCalledWith( expect.objectContaining( {
                moduleId: 'm', slug: 'two-pointers', position: 2, status: CatalogStatus.Published,
            } ) );
        } );

        it( 'create and update report a taken slug', async () => {
            db.repo( Topic ).save.mockRejectedValue( unique );

            await expect( service.create( ORG, 'm', { title: 'X', slug: 'taken' } ) ).rejects.toThrow( 'already has a topic with slug "taken"' );
            await expect( service.update( ORG, 'topic-1', { title: 'Y' } ) ).rejects.toThrow( ConflictException );
        } );

        it( 'remove follows the catalog\'s delete rule', async () => {
            db.repo( Topic ).findOneBy.mockResolvedValue( { id: 'topic-1', status: CatalogStatus.Published } );

            await expect( service.remove( null, 'topic-1' ) ).rejects.toThrow( ConflictException );
            await service.remove( ORG, 'topic-1' );

            expect( db.repo( Topic ).remove ).toHaveBeenCalledOnce();
        } );

        it( 'reorder needs every topic of the module exactly once', async () => {
            db.repo( Topic ).find.mockResolvedValueOnce( [ { id: 'a' }, { id: 'b' } ] );
            await service.reorder( ORG, 'm', [ 'b', 'a' ] );
            expect( db.query ).toHaveBeenCalledWith( expect.stringContaining( 'UPDATE "topics"' ), [ [ 'b', 'a' ], 'm' ] );

            db.repo( Topic ).find.mockResolvedValueOnce( [ { id: 'a' } ] );
            await expect( service.reorder( ORG, 'm', [] ) ).rejects.toThrow( BadRequestException );
        } );
    } );

    describe( 'items of a topic', () => {
        const link = ( itemId: string, position: number ) => ( { topicId: 'topic-1', itemId, position, isOptional: false, item: { id: itemId } } );

        it( 'listItems returns the topic\'s items in order, each with its position', async () => {
            db.repo( TopicItem ).find.mockResolvedValue( [ link( 'a', 1 ), link( 'b', 2 ) ] );

            expect( await service.listItems( ORG, 'topic-1' ) ).toEqual( [
                { id: 'a', position: 1, isOptional: false },
                { id: 'b', position: 2, isOptional: false },
            ] );
        } );

        it( 'reorderItems writes positions on the item ids, then returns the new order', async () => {
            db.repo( TopicItem ).find.mockResolvedValueOnce( [ { itemId: 'a' }, { itemId: 'b' } ] );
            db.repo( TopicItem ).find.mockResolvedValueOnce( [ link( 'b', 1 ), link( 'a', 2 ) ] );

            const items = await service.reorderItems( ORG, 'topic-1', [ 'b', 'a' ] );

            expect( db.query ).toHaveBeenCalledWith( expect.stringContaining( 't."item_id" = o.id AND t."topic_id" = $2' ), [ [ 'b', 'a' ], 'topic-1' ] );
            expect( items.map( ( item ) => item.id ) ).toEqual( [ 'b', 'a' ] );
        } );

        it( 'unlinkItem removes the placement, or is "not found" if the item isn\'t there', async () => {
            await service.unlinkItem( ORG, 'topic-1', 'a' );
            expect( db.repo( TopicItem ).delete ).toHaveBeenCalledWith( { topicId: 'topic-1', itemId: 'a' } );

            db.repo( TopicItem ).delete.mockResolvedValue( { affected: 0 } );
            await expect( service.unlinkItem( ORG, 'topic-1', 'a' ) ).rejects.toThrow( 'This item is not in this topic' );
        } );
    } );
} );
