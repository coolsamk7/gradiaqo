import { EmailCode } from './email-code.entity.js';
import { Enrollment } from './enrollment.entity.js';
import { EnrollmentOrder } from './enrollment-order.entity.js';
import { EnrollmentRule } from './enrollment-rule.entity.js';
import { InterviewGoal } from './interview-goal.entity.js';
import { Item } from './item.entity.js';
import { ItemProgress } from './item-progress.entity.js';
import { LearningModule } from './learning-module.entity.js';
import { LearningPath } from './learning-path.entity.js';
import { Membership } from './membership.entity.js';
import { Organization } from './organization.entity.js';
import { OrganizationInvitation } from './organization-invitation.entity.js';
import { PathReport } from './path-report.entity.js';
import { Session } from './session.entity.js';
import { StudySession } from './study-session.entity.js';
import { Topic } from './topic.entity.js';
import { TopicItem } from './topic-item.entity.js';
import { User } from './user.entity.js';

/** Every entity, for DataSource / TypeOrmModule configuration. */
export const entities = [
    User,
    Session,
    Organization,
    Membership,
    LearningPath,
    LearningModule,
    Topic,
    Item,
    TopicItem,
    Enrollment,
    EnrollmentRule,
    EnrollmentOrder,
    ItemProgress,
    StudySession,
    OrganizationInvitation,
    PathReport,
    InterviewGoal,
    EmailCode,
];
