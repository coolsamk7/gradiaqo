import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ItemProgress, ProgressStatus } from '@studylog/database';
import type { StudyStats } from '@studylog/schemas';
import { DataSource, In } from 'typeorm';

import { computeStreaks, lastDays, startOfWeek, toLocalDate } from '../stats-dates.js';

@Injectable()
export class StatsService {
    constructor( @InjectDataSource() private readonly dataSource: DataSource ) {}

    /** Study time and streaks, with days counted in the user's time zone. */
    async get( userId: string, timeZone = 'UTC' ): Promise<StudyStats> {
        assertTimeZone( timeZone );

        // Minutes per local day, every day the user studied.
        const rows: { day: string; minutes: number }[] = await this.dataSource.query(
            `SELECT to_char( ( started_at AT TIME ZONE $2 )::date, 'YYYY-MM-DD' ) AS day,
                    SUM( duration_minutes )::int AS minutes
             FROM study_sessions
             WHERE user_id = $1
             GROUP BY 1
             ORDER BY 1`,
            [ userId, timeZone ],
        );
        const minutesByDay = new Map( rows.map( ( row ) => [ row.day, row.minutes ] ) );
        const today = toLocalDate( new Date(), timeZone );
        const weekStart = startOfWeek( today );
        const sumWhere = ( keep: ( day: string ) => boolean ) =>
            rows.filter( ( row ) => keep( row.day ) ).reduce( ( sum, row ) => sum + row.minutes, 0 );
        const { current, longest } = computeStreaks( rows.map( ( row ) => row.day ), today );
        const itemsCompleted = await this.dataSource.getRepository( ItemProgress ).countBy( {
            userId,
            status: In( [ ProgressStatus.Done, ProgressStatus.Revise ] ),
        } );

        return {
            timeZone,
            todayMinutes: minutesByDay.get( today ) ?? 0,
            weekMinutes: sumWhere( ( day ) => day >= weekStart && day <= today ),
            totalMinutes: sumWhere( () => true ),
            currentStreakDays: current,
            longestStreakDays: longest,
            itemsCompleted,
            last30Days: lastDays( today, 30 ).map( ( date ) => ( { date, minutes: minutesByDay.get( date ) ?? 0 } ) ),
        };
    }
}

function assertTimeZone( timeZone: string ): void {
    try {
        new Intl.DateTimeFormat( 'en-US', { timeZone } );
    } catch {
        throw new BadRequestException( `Unknown time zone "${timeZone}"` );
    }
}
