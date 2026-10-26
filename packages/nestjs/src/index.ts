import { typebox } from '@gradiaqo/nestjs-typebox';
import type { ItemType } from '@studylog/schemas';
import {
    AccessTokenResponse,
    AdminOrganizationPage,
    AdminUser,
    AdminUserPage,
    Analytics,
    AnalyticsQuery,
    AuthResponse,
    ChangeEmailRequest,
    ChangePasswordRequest,
    CreateEnrollmentRequest,
    CreateInvitationRequest,
    CreateItemRequest,
    CreateLearningModuleRequest,
    CreateLearningPathRequest,
    CreateOrganizationRequest,
    CreateReportRequest,
    CreateStudySessionRequest,
    CreateTopicRequest,
    DeleteAccountRequest,
    Enrollment,
    EnrollmentDetail,
    ForgotPasswordRequest,
    HealthResponse,
    InterviewGoal,
    Invitation,
    Item,
    ItemDetailsSchemas,
    ItemPage,
    ItemProgress,
    ItemProgressPage,
    LearningModule,
    LearningPath,
    LearningPathTree,
    LinkItemRequest,
    ListItemsQuery,
    ListOrganizationsQuery,
    ListProgressQuery,
    ListPublishedPathsQuery,
    ListReportsQuery,
    ListStudySessionsQuery,
    ListUsersQuery,
    LoginRequest,
    ManagedItemPage,
    ManagedLearningPath,
    Member,
    MyInvitation,
    MyOrganization,
    OrganizationSummary,
    PlatformOverview,
    PublishedPath,
    PublishedPathSummary,
    Readiness,
    ReadinessQuery,
    ReorderRequest,
    ReplaceRulesRequest,
    Report,
    ReportPage,
    ResetPasswordRequest,
    ResolveReportRequest,
    SetInterviewGoalRequest,
    SignupRequest,
    StatsQuery,
    StudySession,
    StudySessionPage,
    StudyStats,
    Topic,
    TopicItem,
    UpdateEnrollmentRequest,
    UpdateItemRequest,
    UpdateLearningModuleRequest,
    UpdateLearningPathRequest,
    UpdateMemberRequest,
    UpdateOrganizationRequest,
    UpdateProfileRequest,
    UpdateProgressRequest,
    UpdateStudySessionRequest,
    UpdateTopicRequest,
    UpdateUserRoleRequest,
    User,
    VerifyEmailRequest,
} from '@studylog/schemas';
import Type from 'typebox';

/*
 * The API contract lives in @studylog/schemas (shared with the frontend). This package wraps those schemas
 * for NestJS: validation with `@Body( { schema } )` and named models in the OpenAPI document.
 */

// ---------- Request bodies: `@Body( { schema: SignupBody } ) body: SignupRequest` ----------

export const SignupBody = typebox( SignupRequest, { name: 'SignupRequest' } );
export const LoginBody = typebox( LoginRequest, { name: 'LoginRequest' } );
export const UpdateOrganizationBody = typebox( UpdateOrganizationRequest, { name: 'UpdateOrganizationRequest' } );

export const CreateLearningPathBody = typebox( CreateLearningPathRequest, { name: 'CreateLearningPathRequest' } );
export const UpdateLearningPathBody = typebox( UpdateLearningPathRequest, { name: 'UpdateLearningPathRequest' } );
export const CreateLearningModuleBody = typebox( CreateLearningModuleRequest, { name: 'CreateLearningModuleRequest' } );
export const UpdateLearningModuleBody = typebox( UpdateLearningModuleRequest, { name: 'UpdateLearningModuleRequest' } );
export const CreateTopicBody = typebox( CreateTopicRequest, { name: 'CreateTopicRequest' } );
export const UpdateTopicBody = typebox( UpdateTopicRequest, { name: 'UpdateTopicRequest' } );
export const CreateItemBody = typebox( CreateItemRequest, { name: 'CreateItemRequest' } );
export const UpdateItemBody = typebox( UpdateItemRequest, { name: 'UpdateItemRequest' } );
export const LinkItemBody = typebox( LinkItemRequest, { name: 'LinkItemRequest' } );
export const ReorderBody = typebox( ReorderRequest, { name: 'ReorderRequest' } );

export const CreateOrganizationBody = typebox( CreateOrganizationRequest, { name: 'CreateOrganizationRequest' } );
export const UpdateMemberBody = typebox( UpdateMemberRequest, { name: 'UpdateMemberRequest' } );
export const CreateInvitationBody = typebox( CreateInvitationRequest, { name: 'CreateInvitationRequest' } );
export const UpdateProfileBody = typebox( UpdateProfileRequest, { name: 'UpdateProfileRequest' } );
export const ChangeEmailBody = typebox( ChangeEmailRequest, { name: 'ChangeEmailRequest' } );
export const ChangePasswordBody = typebox( ChangePasswordRequest, { name: 'ChangePasswordRequest' } );
export const DeleteAccountBody = typebox( DeleteAccountRequest, { name: 'DeleteAccountRequest' } );
export const VerifyEmailBody = typebox( VerifyEmailRequest, { name: 'VerifyEmailRequest' } );
export const ForgotPasswordBody = typebox( ForgotPasswordRequest, { name: 'ForgotPasswordRequest' } );
export const ResetPasswordBody = typebox( ResetPasswordRequest, { name: 'ResetPasswordRequest' } );
export const CreateReportBody = typebox( CreateReportRequest, { name: 'CreateReportRequest' } );
export const ResolveReportBody = typebox( ResolveReportRequest, { name: 'ResolveReportRequest' } );
export const UpdateUserRoleBody = typebox( UpdateUserRoleRequest, { name: 'UpdateUserRoleRequest' } );

export const CreateEnrollmentBody = typebox( CreateEnrollmentRequest, { name: 'CreateEnrollmentRequest' } );
export const UpdateEnrollmentBody = typebox( UpdateEnrollmentRequest, { name: 'UpdateEnrollmentRequest' } );
export const ReplaceRulesBody = typebox( ReplaceRulesRequest, { name: 'ReplaceRulesRequest' } );
export const UpdateProgressBody = typebox( UpdateProgressRequest, { name: 'UpdateProgressRequest' } );
export const CreateStudySessionBody = typebox( CreateStudySessionRequest, { name: 'CreateStudySessionRequest' } );
export const UpdateStudySessionBody = typebox( UpdateStudySessionRequest, { name: 'UpdateStudySessionRequest' } );
export const SetInterviewGoalBody = typebox( SetInterviewGoalRequest, { name: 'SetInterviewGoalRequest' } );

// ---------- Query strings: `@Query( { schema: ListItemsQueryParams } ) query: ListItemsQuery` ----------

export const ListItemsQueryParams = typebox( ListItemsQuery, { coerce: true, location: 'query' } );
export const ListProgressQueryParams = typebox( ListProgressQuery, { coerce: true, location: 'query' } );
export const ListStudySessionsQueryParams = typebox( ListStudySessionsQuery, { coerce: true, location: 'query' } );
export const ListPublishedPathsQueryParams = typebox( ListPublishedPathsQuery, { coerce: true, location: 'query' } );
export const ListReportsQueryParams = typebox( ListReportsQuery, { coerce: true, location: 'query' } );
export const ListUsersQueryParams = typebox( ListUsersQuery, { coerce: true, location: 'query' } );
export const ListOrganizationsQueryParams = typebox( ListOrganizationsQuery, { coerce: true, location: 'query' } );
export const StatsQueryParams = typebox( StatsQuery, { coerce: true, location: 'query' } );
export const AnalyticsQueryParams = typebox( AnalyticsQuery, { coerce: true, location: 'query' } );
export const ReadinessQueryParams = typebox( ReadinessQuery, { coerce: true, location: 'query' } );

// ---------- Item details, checked against the item's type: `ItemDetails[ type ].safeParse( details )` ----------

export const ItemDetails = Object.fromEntries(
    Object.entries( ItemDetailsSchemas ).map( ( [ type, schema ] ) => [ type, typebox( schema ) ] ),
) as { [K in ItemType]: ReturnType<typeof typebox<( typeof ItemDetailsSchemas )[K]>> };

// ---------- Responses: `@TypeboxResponse( Responses.User )` ----------

export const Responses = {
    AuthResponse: typebox( AuthResponse, { name: 'AuthResponse', direction: 'response' } ),
    AccessTokenResponse: typebox( AccessTokenResponse, { name: 'AccessTokenResponse', direction: 'response' } ),
    User: typebox( User, { name: 'User', direction: 'response' } ),
    MyOrganization: typebox( MyOrganization, { name: 'MyOrganization', direction: 'response' } ),
    MyOrganizationList: typebox( Type.Array( MyOrganization ), { name: 'MyOrganizationList', direction: 'response' } ),
    OrganizationSummaryList: typebox( Type.Array( OrganizationSummary ), { name: 'OrganizationSummaryList', direction: 'response' } ),
    MemberList: typebox( Type.Array( Member ), { name: 'MemberList', direction: 'response' } ),
    LearningPath: typebox( LearningPath, { name: 'LearningPath', direction: 'response' } ),
    LearningPathList: typebox( Type.Array( LearningPath ), { name: 'LearningPathList', direction: 'response' } ),
    ManagedLearningPathList: typebox( Type.Array( ManagedLearningPath ), { name: 'ManagedLearningPathList', direction: 'response' } ),
    LearningPathTree: typebox( LearningPathTree, { name: 'LearningPathTree', direction: 'response' } ),
    LearningModule: typebox( LearningModule, { name: 'LearningModule', direction: 'response' } ),
    LearningModuleList: typebox( Type.Array( LearningModule ), { name: 'LearningModuleList', direction: 'response' } ),
    Topic: typebox( Topic, { name: 'Topic', direction: 'response' } ),
    TopicList: typebox( Type.Array( Topic ), { name: 'TopicList', direction: 'response' } ),
    TopicItem: typebox( TopicItem, { name: 'TopicItem', direction: 'response' } ),
    TopicItemList: typebox( Type.Array( TopicItem ), { name: 'TopicItemList', direction: 'response' } ),
    Item: typebox( Item, { name: 'Item', direction: 'response' } ),
    ItemPage: typebox( ItemPage, { name: 'ItemPage', direction: 'response' } ),
    ManagedItemPage: typebox( ManagedItemPage, { name: 'ManagedItemPage', direction: 'response' } ),
    PublishedPath: typebox( PublishedPath, { name: 'PublishedPath', direction: 'response' } ),
    PublishedPathList: typebox( Type.Array( PublishedPathSummary ), { name: 'PublishedPathList', direction: 'response' } ),
    Enrollment: typebox( Enrollment, { name: 'Enrollment', direction: 'response' } ),
    EnrollmentList: typebox( Type.Array( Enrollment ), { name: 'EnrollmentList', direction: 'response' } ),
    EnrollmentDetail: typebox( EnrollmentDetail, { name: 'EnrollmentDetail', direction: 'response' } ),
    ItemProgress: typebox( ItemProgress, { name: 'ItemProgress', direction: 'response' } ),
    ItemProgressPage: typebox( ItemProgressPage, { name: 'ItemProgressPage', direction: 'response' } ),
    StudySession: typebox( StudySession, { name: 'StudySession', direction: 'response' } ),
    StudySessionPage: typebox( StudySessionPage, { name: 'StudySessionPage', direction: 'response' } ),
    StudyStats: typebox( StudyStats, { name: 'StudyStats', direction: 'response' } ),
    Analytics: typebox( Analytics, { name: 'Analytics', direction: 'response' } ),
    InterviewGoal: typebox( InterviewGoal, { name: 'InterviewGoal', direction: 'response' } ),
    Readiness: typebox( Readiness, { name: 'Readiness', direction: 'response' } ),
    HealthResponse: typebox( HealthResponse, { name: 'HealthResponse', direction: 'response' } ),
    InvitationList: typebox( Type.Array( Invitation ), { name: 'InvitationList', direction: 'response' } ),
    Invitation: typebox( Invitation, { name: 'Invitation', direction: 'response' } ),
    MyInvitationList: typebox( Type.Array( MyInvitation ), { name: 'MyInvitationList', direction: 'response' } ),
    Member: typebox( Member, { name: 'Member', direction: 'response' } ),
    Report: typebox( Report, { name: 'Report', direction: 'response' } ),
    ReportPage: typebox( ReportPage, { name: 'ReportPage', direction: 'response' } ),
    AdminUserPage: typebox( AdminUserPage, { name: 'AdminUserPage', direction: 'response' } ),
    AdminUser: typebox( AdminUser, { name: 'AdminUser', direction: 'response' } ),
    PlatformOverview: typebox( PlatformOverview, { name: 'PlatformOverview', direction: 'response' } ),
    AdminOrganizationPage: typebox( AdminOrganizationPage, { name: 'AdminOrganizationPage', direction: 'response' } ),
} as const;
