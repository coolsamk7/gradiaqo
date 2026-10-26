import { PlatformRole, User } from '@studylog/database';
import type { DataSource } from 'typeorm';
import { IsNull, MoreThanOrEqual, Not } from 'typeorm';

import { AdminOverviewService, perDay } from '../../../../src/admin/services/admin-overview.service.js';
import type { FakeDataSource } from '../../fake-data-source.js';
import { fakeDataSource } from '../../fake-data-source.js';

const NOW = new Date( '2026-10-26T15:00:00.000Z' );
const DAY = 24 * 60 * 60 * 1000;

describe( 'perDay', () => {
    it( 'has every day of the last 30, oldest first and ending today (UTC), with 0 for days without any', () => {
        const days = perDay( [ { day: '2026-10-26', count: 3 }, { day: '2026-09-27', count: 1 }, { day: '2026-09-01', count: 9 } ], NOW );

        expect( days ).toHaveLength( 30 );
        expect( days[0] ).toEqual( { date: '2026-09-27', count: 1 } );
        expect( days[1] ).toEqual( { date: '2026-09-28', count: 0 } );
        expect( days.at( -1 ) ).toEqual( { date: '2026-10-26', count: 3 } );
    } );

    it( 'takes another number of days', () => {
        expect( perDay( [], NOW, 2 ) ).toEqual( [ { date: '2026-10-25', count: 0 }, { date: '2026-10-26', count: 0 } ] );
    } );
} );

describe( 'AdminOverviewService', () => {
    let db: FakeDataSource;
    let service: AdminOverviewService;
    const STUDY = { learners: 4, sessions: 12, minutes: 540 };
    const TOP = [ { id: 'p1', title: 'DSA', official: true, enrollments: 7 } ];

    beforeEach( () => {
        db = fakeDataSource();
        db.repo( User ).count.mockResolvedValue( 10 );
        db.repo( User ).countBy.mockImplementation( ( where: Record<string, unknown> ) => {
            if ( 'emailVerifiedAt' in where ) {
                return Promise.resolve( 8 );
            }
            if ( 'platformRole' in where ) {
                return Promise.resolve( 1 );
            }

            const since = ( where.lastActiveAt as { value: Date } ).value;

            return Promise.resolve( since.getTime() === NOW.getTime() - 7 * DAY ? 3 : 6 );
        } );
        db.query.mockImplementation( ( sql: string ) => {
            if ( sql.includes( 'FROM users' ) ) {
                return Promise.resolve( [ { day: '2026-10-26', count: 2 }, { day: '2026-10-20', count: 1 } ] );
            }

            return Promise.resolve( sql.includes( 'FROM study_sessions' ) ? [ STUDY ] : TOP );
        } );
        service = new AdminOverviewService( db as unknown as DataSource );
    } );

    it( 'counts accounts, active users, sign-ups, study and the most followed paths', async () => {
        const overview = await service.overview( NOW );

        expect( overview.users ).toEqual( { total: 10, verified: 8, superadmins: 1 } );
        expect( overview.activeUsers ).toEqual( { last7Days: 3, last30Days: 6 } );
        expect( overview.signups.last30Days ).toBe( 3 );
        expect( overview.signups.perDay ).toHaveLength( 30 );
        expect( overview.signups.perDay.at( -1 ) ).toEqual( { date: '2026-10-26', count: 2 } );
        expect( overview.study ).toEqual( STUDY );
        expect( overview.topPaths ).toEqual( TOP );
    } );

    it( 'asks for the right rows', async () => {
        await service.overview( NOW );

        expect( db.repo( User ).countBy ).toHaveBeenCalledWith( { emailVerifiedAt: Not( IsNull() ) } );
        expect( db.repo( User ).countBy ).toHaveBeenCalledWith( { platformRole: PlatformRole.Superadmin } );
        const activeSince = ( days: number ) =>
            ( { lastActiveAt: MoreThanOrEqual( new Date( NOW.getTime() - days * DAY ) ) } );

        expect( db.repo( User ).countBy ).toHaveBeenCalledWith( activeSince( 7 ) );
        expect( db.repo( User ).countBy ).toHaveBeenCalledWith( activeSince( 30 ) );

        const [ signups, study, top ] = db.query.mock.calls as [ string, unknown[]? ][];

        // Sign-ups from midnight UTC on the chart's first day; study over the last 30 days to the minute.
        expect( signups[0] ).toContain( 'to_char( created_at AT TIME ZONE \'UTC\', \'YYYY-MM-DD\' ) AS day' );
        expect( signups[0] ).toContain( 'WHERE created_at >= $1 GROUP BY day' );
        expect( signups[1] ).toEqual( [ new Date( '2026-09-27T00:00:00.000Z' ) ] );
        expect( study[0] ).toContain( 'COUNT( DISTINCT user_id )::int AS learners' );
        expect( study[0] ).toContain( 'COALESCE( SUM( duration_minutes ), 0 )::int AS minutes' );
        expect( study[0] ).toContain( 'WHERE started_at >= $1' );
        expect( study[1] ).toEqual( [ new Date( NOW.getTime() - 30 * DAY ) ] );
        expect( top[0] ).toContain( 'path.organization_id IS NULL AS official' );
        expect( top[0] ).toContain( 'ORDER BY enrollments DESC, path.title ASC LIMIT 5' );
    } );

    it( 'defaults to now', async () => {
        await service.overview();

        expect( db.repo( User ).count ).toHaveBeenCalledOnce();
    } );
} );
