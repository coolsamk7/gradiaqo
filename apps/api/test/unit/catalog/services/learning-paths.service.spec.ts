import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AuditAction, CatalogStatus, Enrollment, LearningPath, Organization, PathVisibility } from '@studylog/database';
import type { DataSource } from 'typeorm';
import { IsNull, QueryFailedError } from 'typeorm';

import type { AuditService } from '../../../../src/audit/services/audit.service.js';
import type { CatalogTreeService } from '../../../../src/catalog/services/catalog-tree.service.js';
import { LearningPathsService } from '../../../../src/catalog/services/learning-paths.service.js';
import type { FakeDataSource } from '../../fake-data-source.js';
import { fakeDataSource } from '../../fake-data-source.js';

const PERSONAL = 'personal-ws';
const GROUP = 'group-org';

describe( 'LearningPathsService', () => {
    let db: FakeDataSource;
    let service: LearningPathsService;
    let audit: { record: ReturnType<typeof vi.fn> };
    const withTree = ( tree: CatalogTreeService ) =>
        new LearningPathsService( db as unknown as DataSource, tree, audit as unknown as AuditService );

    beforeEach( () => {
        db = fakeDataSource();
        audit = { record: vi.fn() };
        db.repo( Organization ).findOneByOrFail.mockImplementation( ( { id }: { id: string } ) =>
            Promise.resolve( { id, isPersonal: id === PERSONAL } ) );
        service = withTree( {} as CatalogTreeService );
    } );

    const saved = () => db.repo( LearningPath ).save.mock.calls[0][0] as LearningPath;

    describe( 'create', () => {
        it( 'global paths start as public drafts, at the end of the list, with a slug from the title', async () => {
            db.repo( LearningPath ).maximum.mockResolvedValue( 4 );

            await service.create( null, { title: 'Data Structures & Algorithms' }, 'admin' );

            expect( saved() ).toMatchObject( {
                organizationId: null,
                status: CatalogStatus.Draft,
                visibility: PathVisibility.Public,
                slug: 'data-structures-algorithms',
                position: 5,
                createdById: 'admin',
            } );
            expect( db.repo( LearningPath ).maximum ).toHaveBeenCalledWith( 'position', { organizationId: IsNull() } );
        } );

        it( 'organization paths start published and private', async () => {
            await service.create( GROUP, { title: 'Group DSA' }, 'sam' );

            expect( saved() ).toMatchObject( {
                organizationId: GROUP,
                status: CatalogStatus.Published,
                visibility: PathVisibility.Private,
            } );
        } );

        it( 'enrolls the creator in a path made in their personal workspace, not in a shared organization', async () => {
            await service.create( PERSONAL, { title: 'Mine' }, 'sam' );
            expect( db.repo( Enrollment ).insert ).toHaveBeenCalledWith( expect.objectContaining( { userId: 'sam' } ) );

            db.repo( Enrollment ).insert.mockClear();
            await service.create( GROUP, { title: 'Ours' }, 'sam' );
            expect( db.repo( Enrollment ).insert ).not.toHaveBeenCalled();
        } );

        it.each( [
            [ 'a private global path', null, PathVisibility.Private, 'Global paths are always public' ],
            [ 'a public path in a shared organization', GROUP, PathVisibility.Public, 'Only paths in a personal workspace can be public' ],
        ] )( 'rejects %s', async ( _, owner, visibility, message ) => {
            await expect( service.create( owner, { title: 'X', visibility }, 'sam' ) ).rejects.toThrow( message );
        } );

        it( 'allows a public path in a personal workspace', async () => {
            await service.create( PERSONAL, { title: 'Shared', visibility: PathVisibility.Public }, 'sam' );

            expect( saved().visibility ).toBe( PathVisibility.Public );
        } );

        it( 'reports a taken slug as a conflict', async () => {
            db.repo( LearningPath ).save.mockRejectedValue( new QueryFailedError( 'INSERT', [], Object.assign( new Error(), { code: '23505' } ) ) );

            await expect( service.create( null, { title: 'DSA' }, 'admin' ) ).rejects.toThrow( ConflictException );
        } );
    } );

    describe( 'findOrFail', () => {
        it( 'only finds paths of the given catalog', async () => {
            await expect( service.findOrFail( GROUP, 'path-1' ) ).rejects.toThrow( NotFoundException );
            expect( db.repo( LearningPath ).findOneBy ).toHaveBeenCalledWith( { id: 'path-1', organizationId: GROUP } );

            await expect( service.findOrFail( null, 'path-1' ) ).rejects.toThrow( NotFoundException );
            expect( db.repo( LearningPath ).findOneBy ).toHaveBeenLastCalledWith( { id: 'path-1', organizationId: IsNull() } );
        } );
    } );

    describe( 'update', () => {
        it( 'refuses to make a path public again after a moderator hid it', async () => {
            db.repo( LearningPath ).findOneBy.mockResolvedValue( { id: 'p', publicBlockedAt: new Date() } );

            await expect( service.update( PERSONAL, 'p', { visibility: PathVisibility.Public }, 'admin' ) ).rejects.toThrow( BadRequestException );
            expect( db.repo( LearningPath ).save ).not.toHaveBeenCalled();
        } );

        it( 'keeps the slug when only the title changes', async () => {
            db.repo( LearningPath ).findOneBy.mockResolvedValue( { id: 'p', slug: 'old', title: 'Old' } );

            await service.update( PERSONAL, 'p', { title: 'New' }, 'admin' );

            expect( saved() ).toMatchObject( { slug: 'old', title: 'New' } );
        } );
    } );

    describe( 'remove', () => {
        it( 'only deletes drafts from the global catalog', async () => {
            db.repo( LearningPath ).findOneBy.mockResolvedValue( { id: 'p', status: CatalogStatus.Published } );

            await expect( service.remove( null, 'p', 'admin' ) ).rejects.toThrow( ConflictException );
            expect( db.repo( LearningPath ).remove ).not.toHaveBeenCalled();
        } );

        it( 'deletes an organization\'s published path', async () => {
            db.repo( LearningPath ).findOneBy.mockResolvedValue( { id: 'p', status: CatalogStatus.Published } );

            await service.remove( PERSONAL, 'p', 'admin' );

            expect( db.repo( LearningPath ).remove ).toHaveBeenCalled();
            expect( audit.record ).not.toHaveBeenCalled();
        } );
    } );

    describe( 'audit log', () => {
        it( 'records a status change or deletion in the global catalog, by whom', async () => {
            db.repo( LearningPath ).findOneBy.mockResolvedValue( { id: 'p', title: 'Graphs', status: CatalogStatus.Draft } );
            db.repo( LearningPath ).save.mockImplementation( ( row: LearningPath ) => Promise.resolve( row ) );

            await service.update( null, 'p', { status: CatalogStatus.Archived }, 'admin' );
            expect( audit.record ).toHaveBeenCalledWith( { actorId: 'admin', action: AuditAction.PathArchived, targetId: 'p', targetLabel: 'Graphs' } );

            db.repo( LearningPath ).findOneBy.mockResolvedValue( { id: 'p', title: 'Graphs', status: CatalogStatus.Draft } );
            await service.remove( null, 'p', 'admin' );
            expect( audit.record ).toHaveBeenLastCalledWith( { actorId: 'admin', action: AuditAction.PathDeleted, targetId: 'p', targetLabel: 'Graphs' } );
        } );

        it( 'records nothing for other changes, or for an organization\'s own paths', async () => {
            db.repo( LearningPath ).save.mockImplementation( ( row: LearningPath ) => Promise.resolve( row ) );
            db.repo( LearningPath ).findOneBy.mockResolvedValue( { id: 'p', title: 'Graphs', status: CatalogStatus.Draft } );
            await service.update( null, 'p', { title: 'Graph Algorithms', status: CatalogStatus.Draft }, 'admin' );

            db.repo( LearningPath ).findOneBy.mockResolvedValue( { id: 'p', title: 'Graphs', status: CatalogStatus.Draft } );
            await service.update( PERSONAL, 'p', { status: CatalogStatus.Archived }, 'admin' );

            expect( audit.record ).not.toHaveBeenCalled();
        } );
    } );

    it( 'lists the paths in order with how many modules and items each has', async () => {
        db.repo( LearningPath ).find.mockResolvedValue( [ { id: 'a' }, { id: 'b' } ] );
        db.query.mockResolvedValue( [ { pathId: 'a', modules: 2, items: 5 } ] );

        expect( await service.list( null ) ).toEqual( [
            { id: 'a', moduleCount: 2, itemCount: 5 },
            { id: 'b', moduleCount: 0, itemCount: 0 },
        ] );
        expect( db.repo( LearningPath ).find ).toHaveBeenCalledWith( expect.objectContaining( { order: { position: 'ASC', createdAt: 'ASC' } } ) );
        expect( db.query ).toHaveBeenCalledWith( expect.stringContaining( 'COUNT(DISTINCT ti.item_id)' ), [ [ 'a', 'b' ] ] );

        db.query.mockClear();
        db.repo( LearningPath ).find.mockResolvedValue( [] );
        expect( await service.list( GROUP ) ).toEqual( [] );
        expect( db.query ).not.toHaveBeenCalled();
    } );

    it( 'reorder needs every path of the catalog exactly once', async () => {
        db.repo( LearningPath ).find.mockResolvedValue( [ { id: 'a' }, { id: 'b' } ] );

        await expect( service.reorder( GROUP, [ 'a' ] ) ).rejects.toThrow( BadRequestException );
        await service.reorder( GROUP, [ 'b', 'a' ] );

        expect( db.query ).toHaveBeenCalledWith( expect.stringContaining( 'UPDATE "learning_paths"' ), [ [ 'b', 'a' ], GROUP ] );
    } );

    describe( 'findTree', () => {
        const treeService = ( load: ReturnType<typeof vi.fn> ) => ( { load } ) as unknown as CatalogTreeService;

        it( 'loads the whole tree (any status) of a path in the catalog', async () => {
            const load = vi.fn().mockResolvedValue( { id: 'p', modules: [] } );

            service = withTree( treeService( load ) );
            db.repo( LearningPath ).findOneBy.mockResolvedValue( { id: 'p' } );

            expect( await service.findTree( GROUP, 'p' ) ).toEqual( { id: 'p', modules: [] } );
            expect( load ).toHaveBeenCalledWith( 'p', { publishedOnly: false } );
        } );

        it( 'is "not found" if the path is deleted while loading', async () => {
            service = withTree( treeService( vi.fn().mockResolvedValue( null ) ) );
            db.repo( LearningPath ).findOneBy.mockResolvedValue( { id: 'p' } );

            await expect( service.findTree( GROUP, 'p' ) ).rejects.toThrow( NotFoundException );
        } );
    } );
} );
