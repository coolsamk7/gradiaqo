import { CatalogStatus, LearningModule, LearningPath, Topic, TopicItem } from '@studylog/database';
import type { DataSource } from 'typeorm';

import { CatalogTreeService } from '../../../../src/catalog/services/catalog-tree.service.js';
import type { FakeDataSource } from '../../fake-data-source.js';
import { fakeDataSource } from '../../fake-data-source.js';

describe( 'CatalogTreeService', () => {
    let db: FakeDataSource;
    let service: CatalogTreeService;

    beforeEach( () => {
        db = fakeDataSource();
        db.repo( LearningPath ).findOneBy.mockResolvedValue( { id: 'dsa', title: 'DSA' } );
        db.repo( LearningModule ).find.mockResolvedValue( [ { id: 'arrays' }, { id: 'searching' } ] );
        db.repo( Topic ).find.mockResolvedValue( [
            { id: 'two-pointers', moduleId: 'arrays' },
            { id: 'hashing', moduleId: 'arrays' },
            { id: 'binary-search', moduleId: 'searching' },
        ] );
        db.repo( TopicItem ).find.mockResolvedValue( [
            { topicId: 'two-pointers', position: 1, isOptional: false, item: { id: 'two-sum', title: 'Two Sum' } },
            { topicId: 'hashing', position: 1, isOptional: true, item: { id: 'two-sum', title: 'Two Sum' } },
            { topicId: 'binary-search', position: 1, isOptional: false, item: { id: 'bs', title: 'Binary Search' } },
        ] );
        service = new CatalogTreeService( db as unknown as DataSource );
    } );

    it( 'nests topics under their module and items under their topic, with each placement\'s position', async () => {
        const tree = await service.load( 'dsa', { publishedOnly: false } );

        const shape = tree?.modules.map( ( m ) => [ m.id, m.topics.map( ( t ) => [ t.id, t.items.map( ( i ) => i.id ) ] ) ] );

        expect( shape ).toEqual( [
            [ 'arrays', [ [ 'two-pointers', [ 'two-sum' ] ], [ 'hashing', [ 'two-sum' ] ] ] ],
            [ 'searching', [ [ 'binary-search', [ 'bs' ] ] ] ],
        ] );
        // The same item in two topics, optional in only one of them.
        expect( tree?.modules[0]?.topics[1]?.items[0] ).toEqual( { id: 'two-sum', title: 'Two Sum', position: 1, isOptional: true } );
    } );

    it( 'loads everything, in order, for admins', async () => {
        await service.load( 'dsa', { publishedOnly: false } );

        expect( db.repo( LearningPath ).findOneBy ).toHaveBeenCalledWith( { id: 'dsa' } );
        expect( db.repo( LearningModule ).find ).toHaveBeenCalledWith( {
            where: { learningPathId: 'dsa' },
            order: { position: 'ASC', createdAt: 'ASC' },
        } );
    } );

    it( 'for users, requires every level to be published, including the items', async () => {
        await service.load( 'dsa', { publishedOnly: true } );

        const published = { status: CatalogStatus.Published };

        expect( db.repo( LearningPath ).findOneBy ).toHaveBeenCalledWith( { id: 'dsa', ...published } );
        expect( db.repo( LearningModule ).find.mock.calls[0][0] ).toMatchObject( { where: published } );
        expect( db.repo( Topic ).find.mock.calls[0][0] ).toMatchObject( { where: published } );
        expect( db.repo( TopicItem ).find.mock.calls[0][0] ).toMatchObject( { where: { item: published } } );
    } );

    it( 'returns null for a missing (or, for users, unpublished) path', async () => {
        db.repo( LearningPath ).findOneBy.mockResolvedValue( null );

        expect( await service.load( 'dsa', { publishedOnly: true } ) ).toBeNull();
        expect( db.repo( LearningModule ).find ).not.toHaveBeenCalled();
    } );
} );
