import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LearningPath, Membership, PathReport, PathVisibility, ReportReason, ReportStatus } from '@studylog/database';
import { ReportAction } from '@studylog/schemas';
import type { DataSource } from 'typeorm';
import { QueryFailedError } from 'typeorm';

import type { FakeDataSource } from '../../test/unit/fake-data-source.js';
import { fakeDataSource } from '../../test/unit/fake-data-source.js';
import type { CatalogAccessService } from '../catalog/catalog-access.service.js';
import { ReportsService } from './reports.service.js';

const communityPath = { id: 'path', organizationId: 'stranger-ws', visibility: PathVisibility.Public, title: 'Graphs' };
const reportRow = ( overrides: object = {} ) => ( {
    id: 'report',
    learningPathId: 'path',
    reason: ReportReason.Spam,
    details: null,
    status: ReportStatus.Open,
    resolutionNote: null,
    resolvedAt: null,
    createdAt: new Date(),
    learningPath: communityPath,
    reporter: { id: 'me', email: 'me@example.com', firstName: 'Me', lastName: 'T', passwordHash: 'x' },
    ...overrides,
} );

describe( 'ReportsService', () => {
    let db: FakeDataSource;
    let access: { canSeePath: ReturnType<typeof vi.fn> };
    let service: ReportsService;

    beforeEach( () => {
        db = fakeDataSource();
        db.repo( LearningPath ).findOneBy.mockResolvedValue( communityPath );
        db.repo( PathReport ).findOneOrFail.mockResolvedValue( reportRow() );
        access = { canSeePath: vi.fn().mockResolvedValue( true ) };
        service = new ReportsService( db as unknown as DataSource, access as unknown as CatalogAccessService );
    } );

    describe( 'create', () => {
        it( 'records an open report from the user', async () => {
            const report = await service.create( 'me', 'path', { reason: ReportReason.Spam, details: 'ads' } );

            expect( db.repo( PathReport ).save ).toHaveBeenCalledWith( expect.objectContaining( {
                learningPathId: 'path', reporterId: 'me', reason: ReportReason.Spam, details: 'ads',
            } ) );
            expect( report.reporter ).not.toHaveProperty( 'passwordHash' );
        } );

        it( 'is "not found" for a path the user can\'t see', async () => {
            access.canSeePath.mockResolvedValue( false );

            await expect( service.create( 'me', 'path', { reason: ReportReason.Spam } ) ).rejects.toThrow( NotFoundException );
        } );

        it( 'only takes user-shared public paths: not official ones, and not the user\'s own', async () => {
            db.repo( LearningPath ).findOneBy.mockResolvedValueOnce( { ...communityPath, organizationId: null } );
            await expect( service.create( 'me', 'path', { reason: ReportReason.Spam } ) ).rejects.toThrow( BadRequestException );

            db.repo( Membership ).existsBy.mockResolvedValueOnce( true );
            await expect( service.create( 'me', 'path', { reason: ReportReason.Spam } ) ).rejects.toThrow( 'You can\'t report your own path' );
        } );

        it( 'allows one open report per user and path', async () => {
            db.repo( PathReport ).save.mockRejectedValue( new QueryFailedError( 'INSERT', [], Object.assign( new Error(), { code: '23505' } ) ) );

            await expect( service.create( 'me', 'path', { reason: ReportReason.Spam } ) ).rejects.toThrow( ConflictException );
        } );
    } );

    describe( 'resolve', () => {
        beforeEach( () => {
            db.repo( PathReport ).findOneBy.mockResolvedValue( reportRow() );
        } );

        it( 'dismiss closes only this report', async () => {
            await service.resolve( 'admin', 'report', { action: ReportAction.Dismiss, note: 'fine' } );

            expect( db.repo( PathReport ).update ).toHaveBeenCalledWith(
                { id: 'report' },
                expect.objectContaining( { status: ReportStatus.Dismissed, resolvedById: 'admin', resolutionNote: 'fine' } ),
            );
            expect( db.repo( LearningPath ).update ).not.toHaveBeenCalled();
        } );

        it( 'hide_path makes the path private for good and closes every open report on it', async () => {
            await service.resolve( 'admin', 'report', { action: ReportAction.HidePath } );

            expect( db.repo( LearningPath ).update ).toHaveBeenCalledWith(
                { id: 'path' },
                { visibility: PathVisibility.Private, publicBlockedAt: expect.any( Date ) },
            );
            expect( db.repo( PathReport ).update ).toHaveBeenCalledWith(
                { learningPathId: 'path', status: ReportStatus.Open },
                expect.objectContaining( { status: ReportStatus.Actioned, resolvedById: 'admin' } ),
            );
        } );

        it( 'refuses an already resolved or unknown report', async () => {
            db.repo( PathReport ).findOneBy.mockResolvedValueOnce( reportRow( { status: ReportStatus.Dismissed } ) );
            await expect( service.resolve( 'admin', 'report', { action: ReportAction.Dismiss } ) ).rejects.toThrow( ConflictException );

            db.repo( PathReport ).findOneBy.mockResolvedValueOnce( null );
            await expect( service.resolve( 'admin', 'report', { action: ReportAction.Dismiss } ) ).rejects.toThrow( NotFoundException );
        } );
    } );

    it( 'lists open reports oldest first by default', async () => {
        await service.list( {} );

        expect( db.repo( PathReport ).findAndCount ).toHaveBeenCalledWith( expect.objectContaining( {
            where: { status: ReportStatus.Open },
            order: { createdAt: 'ASC', id: 'ASC' },
            take: 50,
            skip: 0,
        } ) );
    } );
} );
