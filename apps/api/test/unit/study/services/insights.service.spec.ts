import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Enrollment, EnrollmentStatus, InterviewGoal, ItemProgress } from '@studylog/database';
import type { EnrollmentDetail } from '@studylog/schemas';
import type { DataSource } from 'typeorm';

import type { EnrollmentsService } from '../../../../src/study/services/enrollments.service.js';
import { InsightsService } from '../../../../src/study/services/insights.service.js';
import type { FakeDataSource } from '../../fake-data-source.js';
import { fakeDataSource } from '../../fake-data-source.js';

const NOW = new Date( '2026-10-19T12:00:00Z' );
const AT = new Date( '2026-10-10T00:00:00Z' );

/** An enrollment with no content: enough to check which paths are loaded and how sessions are counted. */
const tree = ( id: string, pathId: string ) => ( {
    id,
    status: EnrollmentStatus.Active,
    learningPath: { id: pathId, title: `Path ${pathId}` },
    progress: { completed: 0, total: 0 },
    modules: [],
} ) as unknown as EnrollmentDetail;

const SESSIONS = [
    { startedAt: new Date( '2026-10-18T09:00:00Z' ), durationMinutes: 30, topicId: 't', itemId: null, learningPathId: 'p1' },
    { startedAt: new Date( '2026-10-17T09:00:00Z' ), durationMinutes: 45, topicId: 't', itemId: null, learningPathId: 'p2' },
];

describe( 'InsightsService', () => {
    let db: FakeDataSource;
    let detail: ReturnType<typeof vi.fn>;
    let service: InsightsService;

    beforeEach( () => {
        vi.useFakeTimers( { now: NOW } );
        db = fakeDataSource();
        detail = vi.fn( ( _user: string, id: string ) => Promise.resolve( tree( id, id === 'e1' ? 'p1' : 'p2' ) ) );
        db.query.mockResolvedValue( SESSIONS );
        service = new InsightsService( db as unknown as DataSource, { detail } as unknown as EnrollmentsService );
    } );

    afterEach( () => {
        vi.useRealTimers();
    } );

    describe( 'analytics', () => {
        it( 'rejects an unknown time zone before loading anything', async () => {
            await expect( service.analytics( 'me', { timeZone: 'Mars/Base' } ) ).rejects.toThrow( BadRequestException );
            expect( db.query ).not.toHaveBeenCalled();
        } );

        it( 'covers every path the user follows, in dashboard order, over the last 30 days by default', async () => {
            db.repo( Enrollment ).find.mockResolvedValue( [ { id: 'e1' }, { id: 'e2' } ] );
            db.repo( ItemProgress ).find.mockResolvedValue( [] );

            const analytics = await service.analytics( 'me', {} );

            expect( analytics ).toMatchObject( { period: '30d', timeZone: 'UTC', totals: { minutes: 75 } } );
            expect( analytics.byPath.map( ( path ) => path.enrollmentId ) ).toEqual( [ 'e2', 'e1' ] );
            expect( db.repo( Enrollment ).find ).toHaveBeenCalledWith( expect.objectContaining( {
                where: { userId: 'me' }, order: { position: 'ASC', createdAt: 'ASC' },
            } ) );
            expect( detail.mock.calls ).toEqual( [ [ 'me', 'e1' ], [ 'me', 'e2' ] ] );
            expect( db.query ).toHaveBeenCalledWith( expect.stringContaining( 'LEFT JOIN topics' ), [ 'me' ] );
            expect( db.repo( ItemProgress ).find ).toHaveBeenCalledWith( expect.objectContaining( { where: { userId: 'me' } } ) );
        } );

        it( 'for one path, loads only it (404 if it isn\'t the user\'s) and counts only its sessions', async () => {
            const analytics = await service.analytics( 'me', { enrollmentId: 'e1', period: 'all', timeZone: 'Asia/Kolkata' } );

            expect( analytics ).toMatchObject( { period: 'all', timeZone: 'Asia/Kolkata', totals: { minutes: 30 } } );
            expect( detail ).toHaveBeenCalledExactlyOnceWith( 'me', 'e1' );
            expect( db.repo( Enrollment ).find ).not.toHaveBeenCalled();

            detail.mockRejectedValue( new NotFoundException() );
            await expect( service.analytics( 'me', { enrollmentId: 'nope' } ) ).rejects.toThrow( NotFoundException );
        } );
    } );

    describe( 'interview goal', () => {
        const stored = { userId: 'me', title: 'SDE interview', targetDate: '2026-11-30', enrollmentIds: [ 'e1' ], createdAt: AT, updatedAt: AT };
        const view = { title: 'SDE interview', targetDate: '2026-11-30', enrollmentIds: [ 'e1' ], updatedAt: AT };

        it( 'returns the goal, or 404 before there is one', async () => {
            await expect( service.goal( 'me' ) ).rejects.toThrow( NotFoundException );

            db.repo( InterviewGoal ).findOneBy.mockResolvedValue( stored );
            await expect( service.goal( 'me' ) ).resolves.toEqual( view );
            expect( db.repo( InterviewGoal ).findOneBy ).toHaveBeenCalledWith( { userId: 'me' } );
        } );

        it( 'saves a goal for paths the user follows', async () => {
            db.repo( Enrollment ).countBy.mockResolvedValue( 1 );
            db.repo( InterviewGoal ).save.mockResolvedValue( stored );

            await expect( service.setGoal( 'me', { title: 'SDE interview', targetDate: '2026-11-30', enrollmentIds: [ 'e1' ] } ) )
                .resolves.toEqual( view );
            expect( db.repo( InterviewGoal ).save ).toHaveBeenCalledWith( {
                userId: 'me', title: 'SDE interview', targetDate: '2026-11-30', enrollmentIds: [ 'e1' ],
            } );
        } );

        it( 'accepts yesterday (today somewhere behind UTC) but not earlier, with the error on the field', async () => {
            db.repo( Enrollment ).countBy.mockResolvedValue( 1 );
            db.repo( InterviewGoal ).save.mockResolvedValue( stored );
            await expect( service.setGoal( 'me', { title: 'x', targetDate: '2026-10-18', enrollmentIds: [ 'e1' ] } ) ).resolves.toBeDefined();

            const error = await service.setGoal( 'me', { title: 'x', targetDate: '2026-10-17', enrollmentIds: [ 'e1' ] } )
                .catch( ( caught: unknown ) => caught );

            expect( error ).toBeInstanceOf( BadRequestException );
            expect( ( error as BadRequestException ).getResponse() ).toMatchObject( {
                errors: [ { path: '/targetDate', message: 'can\'t be in the past' } ],
            } );
        } );

        it( 'rejects paths the user doesn\'t follow', async () => {
            db.repo( Enrollment ).countBy.mockResolvedValue( 1 );

            const error = await service.setGoal( 'me', { title: 'x', targetDate: '2026-11-30', enrollmentIds: [ 'e1', 'theirs' ] } )
                .catch( ( caught: unknown ) => caught );

            expect( ( error as BadRequestException ).getResponse() ).toMatchObject( {
                errors: [ { path: '/enrollmentIds', message: 'must be paths you follow' } ],
            } );
            expect( db.repo( Enrollment ).countBy ).toHaveBeenCalledWith( { userId: 'me', id: expect.anything() } );
            expect( db.repo( InterviewGoal ).save ).not.toHaveBeenCalled();
        } );

        it( 'removes the goal, or 404 if there is none', async () => {
            await expect( service.removeGoal( 'me' ) ).resolves.toBeUndefined();
            expect( db.repo( InterviewGoal ).delete ).toHaveBeenCalledWith( { userId: 'me' } );

            db.repo( InterviewGoal ).delete.mockResolvedValue( { affected: 0 } );
            await expect( service.removeGoal( 'me' ) ).rejects.toThrow( NotFoundException );
        } );
    } );

    describe( 'readiness', () => {
        it( 'rejects an unknown time zone', async () => {
            await expect( service.readiness( 'me', 'Mars/Base' ) ).rejects.toThrow( BadRequestException );
        } );

        it( 'is empty until the user sets a goal', async () => {
            await expect( service.readiness( 'me' ) ).resolves.toEqual( { goal: null, readiness: null } );
            expect( db.query ).not.toHaveBeenCalled();
        } );

        it( 'counts only the goal\'s paths the user still follows', async () => {
            db.repo( InterviewGoal ).findOneBy.mockResolvedValue( {
                userId: 'me', title: 'SDE interview', targetDate: '2026-11-30', enrollmentIds: [ 'e1', 'left' ], createdAt: AT, updatedAt: AT,
            } );
            db.repo( Enrollment ).find.mockResolvedValue( [ { id: 'e1' } ] );

            const result = await service.readiness( 'me', 'Asia/Kolkata' );

            expect( result.goal ).toEqual( { title: 'SDE interview', targetDate: '2026-11-30', enrollmentIds: [ 'e1', 'left' ], updatedAt: AT } );
            expect( result.readiness ).toMatchObject( { daysLeft: 42 } );
            expect( detail ).toHaveBeenCalledExactlyOnceWith( 'me', 'e1' );
            expect( db.repo( Enrollment ).find ).toHaveBeenCalledWith( expect.objectContaining( { where: { userId: 'me', id: expect.anything() } } ) );
        } );
    } );
} );
