import type { AccessTokenPayload } from '@studylog/casl';
import { EnrollmentStatus, OrderParentType, ProgressStatus } from '@studylog/database';

import { EnrollmentsController } from '../../../../src/study/controllers/enrollments.controller.js';
import { InsightsController } from '../../../../src/study/controllers/insights.controller.js';
import { ProgressController } from '../../../../src/study/controllers/progress.controller.js';
import { StatsController } from '../../../../src/study/controllers/stats.controller.js';
import { StudySessionsController } from '../../../../src/study/controllers/study-sessions.controller.js';
import type { EnrollmentsService } from '../../../../src/study/services/enrollments.service.js';
import type { InsightsService } from '../../../../src/study/services/insights.service.js';
import type { ProgressService } from '../../../../src/study/services/progress.service.js';
import type { StatsService } from '../../../../src/study/services/stats.service.js';
import type { StudySessionsService } from '../../../../src/study/services/study-sessions.service.js';

/* Everything under /me acts for the logged-in user: every call must carry user.sub. */

const user = { sub: 'me' } as AccessTokenPayload;
const mocks = <T extends string>( ...methods: T[] ) =>
    Object.fromEntries( methods.map( ( method ) => [ method, vi.fn().mockResolvedValue( `${method} result` ) ] ) ) as Record<T, ReturnType<typeof vi.fn>>;

const enrollments = mocks( 'list', 'create', 'reorder', 'detail', 'updateStatus', 'remove', 'replaceRules', 'setOrder', 'clearOrder' );
const progress = mocks( 'list', 'get', 'set' );
const sessions = mocks( 'list', 'create', 'update', 'remove' );
const stats = mocks( 'get' );
const insights = mocks( 'analytics', 'goal', 'setGoal', 'removeGoal', 'readiness' );

const controllers = {
    enrollments: new EnrollmentsController( enrollments as unknown as EnrollmentsService ),
    progress: new ProgressController( progress as unknown as ProgressService ),
    sessions: new StudySessionsController( sessions as unknown as StudySessionsService ),
    stats: new StatsController( stats as unknown as StatsService ),
    insights: new InsightsController( insights as unknown as InsightsService ),
};
const goal = { title: 'SDE interview', targetDate: '2026-11-30', enrollmentIds: [ 'e' ] };

const rules = [];
const session = { topicId: 't', startedAt: new Date(), durationMinutes: 5 };

type Case = [ string, () => Promise<unknown>, ReturnType<typeof vi.fn>, unknown[] ];

describe( 'study controllers', () => {
    it.each<Case>( [
        [ 'enrollments.list', () => controllers.enrollments.list( user ), enrollments.list, [ 'me' ] ],
        [ 'enrollments.create', () => controllers.enrollments.create( user, { learningPathId: 'p' } ), enrollments.create, [ 'me', { learningPathId: 'p' } ] ],
        [ 'enrollments.reorder', () => controllers.enrollments.reorder( user, { ids: [ 'e' ] } ), enrollments.reorder, [ 'me', [ 'e' ] ] ],
        [ 'enrollments.detail', () => controllers.enrollments.detail( user, 'e' ), enrollments.detail, [ 'me', 'e' ] ],
        [ 'enrollments.update', () => controllers.enrollments.update( user, 'e', { status: EnrollmentStatus.Paused } ), enrollments.updateStatus, [ 'me', 'e', EnrollmentStatus.Paused ] ],
        [ 'enrollments.remove', () => controllers.enrollments.remove( user, 'e' ), enrollments.remove, [ 'me', 'e' ] ],
        [ 'enrollments.replaceRules', () => controllers.enrollments.replaceRules( user, 'e', { rules } ), enrollments.replaceRules, [ 'me', 'e', rules ] ],
        [ 'enrollments.setOrder', () => controllers.enrollments.setOrder( user, 'e', OrderParentType.Topic, 't', { ids: [ 'i' ] } ), enrollments.setOrder, [ 'me', 'e', OrderParentType.Topic, 't', [ 'i' ] ] ],
        [ 'enrollments.clearOrder', () => controllers.enrollments.clearOrder( user, 'e', OrderParentType.Topic, 't' ), enrollments.clearOrder, [ 'me', 'e', OrderParentType.Topic, 't' ] ],
        [ 'progress.list', () => controllers.progress.list( user, {} ), progress.list, [ 'me', {} ] ],
        [ 'progress.get', () => controllers.progress.get( user, 'i' ), progress.get, [ 'me', 'i' ] ],
        [ 'progress.set', () => controllers.progress.set( user, 'i', { status: ProgressStatus.Done } ), progress.set, [ 'me', 'i', ProgressStatus.Done ] ],
        [ 'sessions.list', () => controllers.sessions.list( user, { limit: 5 } ), sessions.list, [ 'me', { limit: 5 } ] ],
        [ 'sessions.create', () => controllers.sessions.create( user, session ), sessions.create, [ 'me', session ] ],
        [ 'sessions.update', () => controllers.sessions.update( user, 's', { notes: 'x' } ), sessions.update, [ 'me', 's', { notes: 'x' } ] ],
        [ 'sessions.remove', () => controllers.sessions.remove( user, 's' ), sessions.remove, [ 'me', 's' ] ],
        [ 'stats.get', () => controllers.stats.get( user, { timeZone: 'Asia/Kolkata' } ), stats.get, [ 'me', 'Asia/Kolkata' ] ],
        [ 'insights.analytics', () => controllers.insights.analytics( user, { period: '90d' } ), insights.analytics, [ 'me', { period: '90d' } ] ],
        [ 'insights.goal', () => controllers.insights.goal( user ), insights.goal, [ 'me' ] ],
        [ 'insights.setGoal', () => controllers.insights.setGoal( user, goal ), insights.setGoal, [ 'me', goal ] ],
        [ 'insights.removeGoal', () => controllers.insights.removeGoal( user ), insights.removeGoal, [ 'me' ] ],
        [ 'insights.readiness', () => controllers.insights.readiness( user, { timeZone: 'UTC' } ), insights.readiness, [ 'me', 'UTC' ] ],
    ] )( '%s acts for the logged-in user', async ( _, call, method, expected ) => {
        await expect( call() ).resolves.toMatch( /result$/ );
        expect( method ).toHaveBeenLastCalledWith( ...expected );
    } );
} );
