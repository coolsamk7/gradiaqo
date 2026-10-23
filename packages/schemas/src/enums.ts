/** App-wide role, stored on the user. */
export enum PlatformRole {
    ApplicationUser = 'application_user',
    Superadmin = 'superadmin',
}

/** Role inside one organization, stored on the membership. */
export enum OrganizationRole {
    Owner = 'owner',
    Admin = 'admin',
    Member = 'member',
}

/**
 * Lifecycle of catalog content (paths, modules, topics, items). Users only ever see `published`;
 * `archived` hides content from new views but keeps it for users' history.
 */
export enum CatalogStatus {
    Draft = 'draft',
    Published = 'published',
    Archived = 'archived',
}

/** Kind of study material. Each type has its own `details` schema (see `ItemDetailsSchemas`). */
export enum ItemType {
    Problem = 'problem',
    Article = 'article',
    Video = 'video',
    Book = 'book',
    Course = 'course',
    Note = 'note',
    Exercise = 'exercise',
}

export enum Difficulty {
    Easy = 'easy',
    Medium = 'medium',
    Hard = 'hard',
}

export enum EnrollmentStatus {
    Active = 'active',
    Paused = 'paused',
    Completed = 'completed',
    Dropped = 'dropped',
}

/** What an enrollment rule points at. A rule covers everything underneath it. */
export enum RuleScope {
    Module = 'module',
    Topic = 'topic',
    Item = 'item',
}

export enum RuleMode {
    Include = 'include',
    Exclude = 'exclude',
}

/** The parent whose children a user reordered: a path's modules, a module's topics or a topic's items. */
export enum OrderParentType {
    Path = 'path',
    Module = 'module',
    Topic = 'topic',
}

/** A user's status on one item. `not_started` is never stored: it's the absence of a progress row. */
export enum ProgressStatus {
    NotStarted = 'not_started',
    InProgress = 'in_progress',
    Done = 'done',
    Revise = 'revise',
}

/**
 * Who can see a learning path besides its organization's members. Global catalog paths are always public;
 * paths in a personal workspace can be made public; paths in a shared organization stay with its members.
 */
export enum PathVisibility {
    Private = 'private',
    Public = 'public',
}

export enum ReportReason {
    Spam = 'spam',
    Inappropriate = 'inappropriate',
    Copyright = 'copyright',
    Other = 'other',
}

export enum ReportStatus {
    Open = 'open',
    Dismissed = 'dismissed',
    /** A moderator acted on it, e.g. took the path out of the public catalog. */
    Actioned = 'actioned',
}

/** What an emailed code is for. Each user has at most one live code per purpose. */
export enum EmailCodePurpose {
    VerifyEmail = 'verify_email',
    ResetPassword = 'reset_password',
}
