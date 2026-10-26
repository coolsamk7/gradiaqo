import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { PlatformRole, User } from '@studylog/database';
import type { PlatformOverview } from '@studylog/schemas';
import { DataSource, IsNull, MoreThanOrEqual, Not } from 'typeorm';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days in the overview's charts and "last 30 days" numbers. */
export const OVERVIEW_DAYS = 30;

/** "2026-10-26": the UTC calendar day of a moment. */
const utcDay = ( date: Date ) => date.toISOString().slice( 0, 10 );

/**
 * One entry per day of the last `days` days, oldest first and ending today (UTC), with the count from `counts`
 * (by "YYYY-MM-DD") or 0.
 */
export function perDay(
    counts: { day: string; count: number }[],
    now: Date,
    days = OVERVIEW_DAYS,
): { date: string; count: number }[] {
    const byDay = new Map( counts.map( ( { day, count } ) => [ day, count ] ) );

    return Array.from( { length: days }, ( _, index ) => {
        const date = utcDay( new Date( now.getTime() - ( days - 1 - index ) * DAY_MS ) );

        return { date, count: byDay.get( date ) ?? 0 };
    } );
}

/** The platform at a glance for superadmins: accounts, activity, sign-ups, study, and the most followed paths. */
@Injectable()
export class AdminOverviewService {
    constructor( @InjectDataSource() private readonly dataSource: DataSource ) {}

    async overview( now = new Date() ): Promise<PlatformOverview> {
        const users = this.dataSource.getRepository( User );
        const since = ( days: number ) => new Date( now.getTime() - days * DAY_MS );
        // The first day of the chart, from midnight UTC.
        const chartStart = new Date( `${utcDay( since( OVERVIEW_DAYS - 1 ) )}T00:00:00.000Z` );

        const [ total, verified, superadmins, active7, active30, signups, [ study ], topPaths ] = await Promise.all( [
            users.count(),
            users.countBy( { emailVerifiedAt: Not( IsNull() ) } ),
            users.countBy( { platformRole: PlatformRole.Superadmin } ),
            users.countBy( { lastActiveAt: MoreThanOrEqual( since( 7 ) ) } ),
            users.countBy( { lastActiveAt: MoreThanOrEqual( since( OVERVIEW_DAYS ) ) } ),
            this.dataSource.query<{ day: string; count: number }[]>(
                `SELECT to_char( created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD' ) AS day, COUNT(*)::int AS count
                 FROM users WHERE created_at >= $1 GROUP BY day`,
                [ chartStart ],
            ),
            this.dataSource.query<{ learners: number; sessions: number; minutes: number }[]>(
                `SELECT COUNT( DISTINCT user_id )::int AS learners, COUNT(*)::int AS sessions,
                        COALESCE( SUM( duration_minutes ), 0 )::int AS minutes
                 FROM study_sessions WHERE started_at >= $1`,
                [ since( OVERVIEW_DAYS ) ],
            ),
            this.dataSource.query<{ id: string; title: string; official: boolean; enrollments: number }[]>(
                `SELECT path.id, path.title, path.organization_id IS NULL AS official, COUNT( enrollment.id )::int AS enrollments
                 FROM enrollments enrollment JOIN learning_paths path ON path.id = enrollment.learning_path_id
                 GROUP BY path.id ORDER BY enrollments DESC, path.title ASC LIMIT 5`,
            ),
        ] );
        const chart = perDay( signups, now );

        return {
            users: { total, verified, superadmins },
            activeUsers: { last7Days: active7, last30Days: active30 },
            signups: { last30Days: chart.reduce( ( sum, day ) => sum + day.count, 0 ), perDay: chart },
            study,
            topPaths,
        };
    }
}
