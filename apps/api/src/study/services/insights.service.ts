import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Enrollment, InterviewGoal, ItemProgress } from '@studylog/database';
import type {
    Analytics,
    AnalyticsQuery,
    EnrollmentDetail,
    InterviewGoal as InterviewGoalView,
    Readiness,
    SetInterviewGoalRequest,
} from '@studylog/schemas';
import { DataSource, In } from 'typeorm';

import type { ProgressRow, SessionRow } from '../insights.js';
import { computeAnalytics, computeReadiness } from '../insights.js';
import { addDays, toLocalDate } from '../stats-dates.js';
import { EnrollmentsService } from './enrollments.service.js';

/** Analytics, the user's interview goal, and readiness for it (see insights.ts for the rules). */
@Injectable()
export class InsightsService {
    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly enrollments: EnrollmentsService,
    ) {}

    async analytics( userId: string, { period = '30d', enrollmentId, timeZone = 'UTC' }: AnalyticsQuery ): Promise<Analytics> {
        assertTimeZone( timeZone );

        const trees = enrollmentId
            ? [ await this.enrollments.detail( userId, enrollmentId ) ]
            : await this.trees( userId );
        const { sessions, progress } = await this.activity( userId );

        return computeAnalytics( {
            period, timeZone, now: new Date(), trees, sessions, progress, scoped: Boolean( enrollmentId ),
        } );
    }

    async goal( userId: string ): Promise<InterviewGoalView> {
        const goal = await this.dataSource.getRepository( InterviewGoal ).findOneBy( { userId } );

        if ( !goal ) {
            throw new NotFoundException( 'No interview goal yet' );
        }

        return toView( goal );
    }

    /** Creates or replaces the goal. The date can't be in the past, and every path must be one the user follows. */
    async setGoal( userId: string, dto: SetInterviewGoalRequest ): Promise<InterviewGoalView> {
        // A day of slack: "today" in the user's time zone can still be yesterday in UTC.
        if ( dto.targetDate < addDays( toLocalDate( new Date(), 'UTC' ), -1 ) ) {
            throw invalid( 'targetDate', 'can\'t be in the past' );
        }

        const found = await this.dataSource.getRepository( Enrollment )
            .countBy( { userId, id: In( dto.enrollmentIds ) } );

        if ( found !== dto.enrollmentIds.length ) {
            throw invalid( 'enrollmentIds', 'must be paths you follow' );
        }

        const repository = this.dataSource.getRepository( InterviewGoal );

        return toView( await repository.save( repository.create( { userId, ...dto } ) ) );
    }

    async removeGoal( userId: string ): Promise<void> {
        const { affected } = await this.dataSource.getRepository( InterviewGoal ).delete( { userId } );

        if ( !affected ) {
            throw new NotFoundException( 'No interview goal yet' );
        }
    }

    /** How ready the user is for their goal; both parts null until they set one. */
    async readiness( userId: string, timeZone = 'UTC' ): Promise<Readiness> {
        assertTimeZone( timeZone );

        const goal = await this.dataSource.getRepository( InterviewGoal ).findOneBy( { userId } );

        if ( !goal ) {
            return { goal: null, readiness: null };
        }

        // Paths the user has left since setting the goal no longer count.
        const kept = await this.dataSource.getRepository( Enrollment ).find( {
            select: { id: true },
            where: { userId, id: In( goal.enrollmentIds ) },
        } );
        const keptIds = new Set( kept.map( ( enrollment ) => enrollment.id ) );
        const trees = await Promise.all( goal.enrollmentIds
            .filter( ( id ) => keptIds.has( id ) )
            .map( ( id ) => this.enrollments.detail( userId, id ) ) );
        const { sessions, progress } = await this.activity( userId );

        return computeReadiness( { goal: toView( goal ), timeZone, now: new Date(), trees, sessions, progress } );
    }

    /** Every path the user follows, as trees with progress. */
    private async trees( userId: string ): Promise<EnrollmentDetail[]> {
        const enrollments = await this.dataSource.getRepository( Enrollment ).find( {
            select: { id: true },
            where: { userId },
            order: { position: 'ASC', createdAt: 'ASC' },
        } );

        return Promise.all( enrollments.map( ( enrollment ) => this.enrollments.detail( userId, enrollment.id ) ) );
    }

    /** All the user's study sessions (with each topic's path) and item progress. */
    private async activity( userId: string ): Promise<{ sessions: SessionRow[]; progress: ProgressRow[] }> {
        const sessions: SessionRow[] = await this.dataSource.query(
            `SELECT s.started_at AS "startedAt", s.duration_minutes AS "durationMinutes", s.topic_id AS "topicId",
                    s.item_id AS "itemId", m.learning_path_id AS "learningPathId"
             FROM study_sessions s
             LEFT JOIN topics t ON t.id = s.topic_id
             LEFT JOIN modules m ON m.id = t.module_id
             WHERE s.user_id = $1`,
            [ userId ],
        );
        const progress = await this.dataSource.getRepository( ItemProgress ).find( {
            select: { itemId: true, status: true, completedAt: true, updatedAt: true },
            where: { userId },
        } );

        return { sessions, progress };
    }
}

function toView( goal: InterviewGoal ): InterviewGoalView {
    const { title, targetDate, enrollmentIds, updatedAt } = goal;

    return { title, targetDate, enrollmentIds, updatedAt };
}

/** A 400 shaped like the validation pipe's, so clients show it on the field. */
function invalid( field: string, message: string ): BadRequestException {
    return new BadRequestException( { statusCode: 400, message: 'Validation failed (body)', errors: [ { path: `/${field}`, message } ] } );
}

function assertTimeZone( timeZone: string ): void {
    try {
        new Intl.DateTimeFormat( 'en-US', { timeZone } );
    } catch {
        throw new BadRequestException( `Unknown time zone "${timeZone}"` );
    }
}
