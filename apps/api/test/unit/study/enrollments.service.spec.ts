import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
    Enrollment,
    EnrollmentOrder,
    EnrollmentRule,
    EnrollmentStatus,
    ItemProgress,
    OrderParentType,
    ProgressStatus,
    RuleMode,
    RuleScope,
} from '@studylog/database';
import type { DataSource } from 'typeorm';
import { QueryFailedError } from 'typeorm';

import type { CatalogAccessService } from '../../../src/catalog/catalog-access.service.js';
import type { CatalogTree, CatalogTreeService } from '../../../src/catalog/catalog-tree.service.js';
import { EnrollmentsService } from '../../../src/study/enrollments.service.js';
import type { FakeDataSource } from '../fake-data-source.js';
import { fakeDataSource } from '../fake-data-source.js';

// DSA → Arrays (Two Pointers: two-sum, video) · Searching (Binary Search: bs). Only ids matter here.
const tree = {
    id: 'dsa',
    title: 'DSA',
    organizationId: null,
    modules: [
        { id: 'arrays', topics: [ { id: 'two-pointers', items: [ { id: 'two-sum', isOptional: false }, { id: 'video', isOptional: false } ] } ] },
        { id: 'searching', topics: [ { id: 'binary-search', items: [ { id: 'bs', isOptional: false } ] } ] },
    ],
} as unknown as CatalogTree;

const enrollment = ( overrides: Partial<Enrollment> = {} ) => ( {
    id: 'enr-1',
    userId: 'me',
    learningPathId: 'dsa',
    status: EnrollmentStatus.Active,
    position: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    learningPath: { id: 'dsa', title: 'DSA' },
    rules: [],
    orders: [],
    ...overrides,
} );

describe( 'EnrollmentsService', () => {
    let db: FakeDataSource;
    let catalogTree: { load: ReturnType<typeof vi.fn> };
    let access: { canSeePath: ReturnType<typeof vi.fn> };
    let service: EnrollmentsService;

    beforeEach( () => {
        db = fakeDataSource();
        catalogTree = { load: vi.fn().mockResolvedValue( tree ) };
        access = { canSeePath: vi.fn().mockResolvedValue( true ) };
        db.repo( Enrollment ).findOne.mockResolvedValue( enrollment() );
        service = new EnrollmentsService(
            db as unknown as DataSource,
            catalogTree as unknown as CatalogTreeService,
            access as unknown as CatalogAccessService,
        );
    } );

    describe( 'create', () => {
        it( 'needs a path the user can see', async () => {
            access.canSeePath.mockResolvedValue( false );

            await expect( service.create( 'me', { learningPathId: 'dsa' } ) ).rejects.toThrow( NotFoundException );
            expect( db.repo( Enrollment ).save ).not.toHaveBeenCalled();
        } );

        it( 'stores the enrollment at the end of the dashboard with its rules', async () => {
            db.repo( Enrollment ).maximum.mockResolvedValue( 2 );
            const rules = [ { scope: RuleScope.Module, scopeId: 'arrays', mode: RuleMode.Include } ];

            await service.create( 'me', { learningPathId: 'dsa', rules } );

            expect( db.repo( Enrollment ).save ).toHaveBeenCalledWith( expect.objectContaining( { userId: 'me', learningPathId: 'dsa', position: 3 } ) );
            expect( db.repo( EnrollmentRule ).insert ).toHaveBeenCalledWith( [ expect.objectContaining( rules[0] ) ] );
        } );

        it.each( [
            [ 'content outside the path', [ { scope: RuleScope.Topic, scopeId: 'elsewhere', mode: RuleMode.Include } ], 'No topic elsewhere in this learning path' ],
            [ 'a module id used as a topic', [ { scope: RuleScope.Topic, scopeId: 'arrays', mode: RuleMode.Include } ], 'No topic arrays' ],
            [ 'two rules for the same thing', [
                { scope: RuleScope.Item, scopeId: 'bs', mode: RuleMode.Include },
                { scope: RuleScope.Item, scopeId: 'bs', mode: RuleMode.Exclude },
            ], 'More than one rule for item bs' ],
        ] )( 'rejects rules pointing at %s', async ( _, rules, message ) => {
            await expect( service.create( 'me', { learningPathId: 'dsa', rules } ) ).rejects.toThrow( message );
        } );

        it( 'reports a second enrollment in the same path as a conflict', async () => {
            db.repo( Enrollment ).save.mockRejectedValue( new QueryFailedError( 'INSERT', [], Object.assign( new Error(), { code: '23505' } ) ) );

            await expect( service.create( 'me', { learningPathId: 'dsa' } ) ).rejects.toThrow( ConflictException );
        } );
    } );

    describe( 'detail', () => {
        it( 'is "not found" for someone else\'s enrollment', async () => {
            db.repo( Enrollment ).findOne.mockResolvedValue( null );

            await expect( service.detail( 'me', 'enr-1' ) ).rejects.toThrow( NotFoundException );
            expect( db.repo( Enrollment ).findOne ).toHaveBeenCalledWith( expect.objectContaining( { where: { id: 'enr-1', userId: 'me' } } ) );
        } );

        it( 'applies rules and order, and counts progress', async () => {
            db.repo( Enrollment ).findOne.mockResolvedValue( enrollment( {
                rules: [ { scope: RuleScope.Item, scopeId: 'video', mode: RuleMode.Exclude } ] as EnrollmentRule[],
                orders: [ { parentType: OrderParentType.Path, parentId: 'dsa', orderedIds: [ 'searching' ] } ] as EnrollmentOrder[],
            } ) );
            db.repo( ItemProgress ).find.mockResolvedValue( [ { itemId: 'bs', status: ProgressStatus.Done } ] );

            const detail = await service.detail( 'me', 'enr-1' );

            expect( detail.modules.map( ( m ) => m.id ) ).toEqual( [ 'searching', 'arrays' ] );
            expect( detail.modules[1].topics[0].items.map( ( i ) => i.id ) ).toEqual( [ 'two-sum' ] );
            expect( detail.progress ).toEqual( { completed: 1, total: 2 } );
        } );

        it( 'shows no content once the user can\'t see the path any more', async () => {
            access.canSeePath.mockResolvedValue( false );

            const detail = await service.detail( 'me', 'enr-1' );

            expect( detail.modules ).toEqual( [] );
            expect( detail.progress ).toEqual( { completed: 0, total: 0 } );
        } );
    } );

    describe( 'setOrder', () => {
        it( 'accepts some or all children of the parent', async () => {
            await service.setOrder( 'me', 'enr-1', OrderParentType.Topic, 'two-pointers', [ 'video' ] );

            expect( db.repo( EnrollmentOrder ).upsert ).toHaveBeenCalledWith(
                { enrollmentId: 'enr-1', parentType: OrderParentType.Topic, parentId: 'two-pointers', orderedIds: [ 'video' ] },
                [ 'enrollmentId', 'parentType', 'parentId' ],
            );
        } );

        it( 'rejects ids that aren\'t children of the parent', async () => {
            await expect( service.setOrder( 'me', 'enr-1', OrderParentType.Topic, 'two-pointers', [ 'bs' ] ) )
                .rejects.toThrow( BadRequestException );
        } );

        it( 'is "not found" for a parent outside the path, or a path parent that isn\'t this path', async () => {
            await expect( service.setOrder( 'me', 'enr-1', OrderParentType.Module, 'graphs', [] ) ).rejects.toThrow( NotFoundException );
            await expect( service.setOrder( 'me', 'enr-1', OrderParentType.Path, 'other-path', [] ) ).rejects.toThrow( NotFoundException );
        } );
    } );

    it( 'replaceRules swaps the rules in one transaction', async () => {
        await service.replaceRules( 'me', 'enr-1', [ { scope: RuleScope.Module, scopeId: 'arrays', mode: RuleMode.Include } ] );

        expect( db.transaction ).toHaveBeenCalledOnce();
        expect( db.repo( EnrollmentRule ).delete ).toHaveBeenCalledWith( { enrollmentId: 'enr-1' } );
        expect( db.repo( EnrollmentRule ).insert ).toHaveBeenCalled();
    } );

    it( 'reorder needs every enrollment of the user exactly once', async () => {
        db.repo( Enrollment ).find.mockResolvedValue( [ { id: 'a' }, { id: 'b' } ] );

        await expect( service.reorder( 'me', [ 'a', 'c' ] ) ).rejects.toThrow( BadRequestException );
    } );

    describe( 'completeFinished', () => {
        it( 'completes active enrollments whose required items are all done or marked for revision', async () => {
            db.repo( Enrollment ).find.mockResolvedValue( [ enrollment() ] );
            db.repo( ItemProgress ).find.mockResolvedValue( [
                { itemId: 'two-sum', status: ProgressStatus.Done },
                { itemId: 'video', status: ProgressStatus.Revise },
                { itemId: 'bs', status: ProgressStatus.Done },
            ] );

            await service.completeFinished( 'me' );

            expect( db.repo( Enrollment ).find ).toHaveBeenCalledWith( expect.objectContaining( { where: { userId: 'me', status: EnrollmentStatus.Active } } ) );
            expect( db.repo( Enrollment ).update ).toHaveBeenCalledWith( { id: 'enr-1' }, { status: EnrollmentStatus.Completed } );
        } );

        it( 'leaves unfinished and empty enrollments alone', async () => {
            db.repo( Enrollment ).find.mockResolvedValue( [ enrollment() ] );
            db.repo( ItemProgress ).find.mockResolvedValue( [ { itemId: 'two-sum', status: ProgressStatus.Done } ] );
            await service.completeFinished( 'me' );

            access.canSeePath.mockResolvedValue( false ); // no content → total 0
            await service.completeFinished( 'me' );

            expect( db.repo( Enrollment ).update ).not.toHaveBeenCalled();
        } );
    } );

    it( 'list returns each enrollment with its progress, without the tree', async () => {
        db.repo( Enrollment ).find.mockResolvedValue( [ enrollment() ] );

        const [ summary ] = await service.list( 'me' );

        expect( summary ).toMatchObject( { id: 'enr-1', progress: { completed: 0, total: 3 } } );
        expect( summary ).not.toHaveProperty( 'modules' );
        expect( summary ).not.toHaveProperty( 'rules' );
    } );

    it( 'updateStatus changes the user\'s own enrollment', async () => {
        await service.updateStatus( 'me', 'enr-1', EnrollmentStatus.Paused );

        expect( db.repo( Enrollment ).update ).toHaveBeenCalledWith( { id: 'enr-1' }, { status: EnrollmentStatus.Paused } );
    } );

    it( 'remove deletes only the user\'s own enrollment', async () => {
        await service.remove( 'me', 'enr-1' );
        expect( db.repo( Enrollment ).delete ).toHaveBeenCalledWith( { id: 'enr-1', userId: 'me' } );

        db.repo( Enrollment ).delete.mockResolvedValue( { affected: 0 } );
        await expect( service.remove( 'me', 'enr-1' ) ).rejects.toThrow( NotFoundException );
    } );

    it( 'reorder writes the dashboard order', async () => {
        db.repo( Enrollment ).find.mockResolvedValueOnce( [ { id: 'a' }, { id: 'b' } ] );

        await service.reorder( 'me', [ 'b', 'a' ] );

        expect( db.query ).toHaveBeenCalledWith( expect.stringContaining( 'UPDATE "enrollments"' ), [ [ 'b', 'a' ], 'me' ] );
    } );

    it( 'clearOrder goes back to the admin\'s order for that parent', async () => {
        await service.clearOrder( 'me', 'enr-1', OrderParentType.Module, 'arrays' );

        expect( db.repo( EnrollmentOrder ).delete ).toHaveBeenCalledWith( { enrollmentId: 'enr-1', parentType: OrderParentType.Module, parentId: 'arrays' } );
    } );

    it( 'setOrder accepts the path\'s modules and a module\'s topics', async () => {
        await service.setOrder( 'me', 'enr-1', OrderParentType.Path, 'dsa', [ 'searching', 'arrays' ] );
        await service.setOrder( 'me', 'enr-1', OrderParentType.Module, 'arrays', [ 'two-pointers' ] );

        expect( db.repo( EnrollmentOrder ).upsert ).toHaveBeenCalledTimes( 2 );
    } );

    it( 'enrolling without rules stores no rules', async () => {
        await service.create( 'me', { learningPathId: 'dsa' } );

        expect( db.repo( EnrollmentRule ).insert ).not.toHaveBeenCalled();
    } );
} );
