import { NotFoundException } from '@nestjs/common';
import { ItemProgress, ProgressStatus } from '@studylog/database';
import type { DataSource } from 'typeorm';

import type { CatalogAccessService } from '../../../src/catalog/catalog-access.service.js';
import type { EnrollmentsService } from '../../../src/study/enrollments.service.js';
import { ProgressService } from '../../../src/study/progress.service.js';
import type { FakeDataSource } from '../fake-data-source.js';
import { fakeDataSource } from '../fake-data-source.js';

const NOW = new Date( '2026-09-25T10:00:00Z' );
const EARLIER = new Date( '2026-09-01T10:00:00Z' );

describe( 'ProgressService', () => {
    let db: FakeDataSource;
    let access: { canSeeItem: ReturnType<typeof vi.fn> };
    let enrollments: { completeFinished: ReturnType<typeof vi.fn> };
    let service: ProgressService;

    beforeEach( () => {
        vi.useFakeTimers( { now: NOW } );
        db = fakeDataSource();
        access = { canSeeItem: vi.fn().mockResolvedValue( true ) };
        enrollments = { completeFinished: vi.fn() };
        service = new ProgressService(
            db as unknown as DataSource,
            access as unknown as CatalogAccessService,
            enrollments as unknown as EnrollmentsService,
        );
    } );

    afterEach( () => {
        vi.useRealTimers();
    } );

    const saved = () => db.repo( ItemProgress ).save.mock.calls[0][0] as ItemProgress;

    it( 'only tracks items the user can see', async () => {
        access.canSeeItem.mockResolvedValue( false );

        await expect( service.set( 'me', 'item', ProgressStatus.Done ) ).rejects.toThrow( NotFoundException );
        await expect( service.get( 'me', 'item' ) ).rejects.toThrow( NotFoundException );
    } );

    it( 'reports not_started (all dates null) when there is no record', async () => {
        expect( await service.get( 'me', 'item' ) ).toEqual( {
            itemId: 'item', status: ProgressStatus.NotStarted, startedAt: null, completedAt: null, updatedAt: null,
        } );
    } );

    it( 'not_started deletes the record', async () => {
        await service.set( 'me', 'item', ProgressStatus.NotStarted );

        expect( db.repo( ItemProgress ).delete ).toHaveBeenCalledWith( { userId: 'me', itemId: 'item' } );
        expect( db.repo( ItemProgress ).save ).not.toHaveBeenCalled();
    } );

    it( 'starting sets startedAt only', async () => {
        await service.set( 'me', 'item', ProgressStatus.InProgress );

        expect( saved() ).toMatchObject( { status: ProgressStatus.InProgress, startedAt: NOW, completedAt: null } );
        expect( enrollments.completeFinished ).not.toHaveBeenCalled();
    } );

    it( 'keeps the first startedAt and completedAt on later changes', async () => {
        db.repo( ItemProgress ).findOneBy
            .mockResolvedValue( { status: ProgressStatus.Done, startedAt: EARLIER, completedAt: EARLIER } );

        await service.set( 'me', 'item', ProgressStatus.Revise );

        expect( saved() ).toMatchObject( { status: ProgressStatus.Revise, startedAt: EARLIER, completedAt: EARLIER } );
    } );

    it.each( [ ProgressStatus.Done, ProgressStatus.Revise ] )( '%s sets completedAt and completes finished enrollments', async ( status ) => {
        await service.set( 'me', 'item', status );

        expect( saved().completedAt ).toEqual( NOW );
        expect( enrollments.completeFinished ).toHaveBeenCalledWith( 'me' );
    } );

    it( 'listing not_started returns nothing (there are no rows for it)', async () => {
        expect( await service.list( 'me', { status: ProgressStatus.NotStarted } ) ).toEqual( { items: [], total: 0 } );
        expect( db.repo( ItemProgress ).findAndCount ).not.toHaveBeenCalled();
    } );

    it( 'list pages through the user\'s progress with each item, optionally by status', async () => {
        const row = { itemId: 'item', status: ProgressStatus.Done, startedAt: NOW, completedAt: NOW, updatedAt: NOW, item: { id: 'item' } };

        db.repo( ItemProgress ).findAndCount.mockResolvedValue( [ [ row ], 1 ] );

        expect( await service.list( 'me', { status: ProgressStatus.Done } ) ).toEqual( {
            items: [ { itemId: 'item', status: ProgressStatus.Done, startedAt: NOW, completedAt: NOW, updatedAt: NOW, item: { id: 'item' } } ],
            total: 1,
        } );
        expect( db.repo( ItemProgress ).findAndCount ).toHaveBeenLastCalledWith( expect.objectContaining( {
            where: { userId: 'me', status: ProgressStatus.Done }, take: 50, skip: 0,
        } ) );

        await service.list( 'me', { limit: 5, offset: 5 } );
        expect( db.repo( ItemProgress ).findAndCount ).toHaveBeenLastCalledWith( expect.objectContaining( {
            where: { userId: 'me' }, take: 5, skip: 5,
        } ) );
    } );
} );
