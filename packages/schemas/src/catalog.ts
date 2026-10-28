import type { StaticDecode, StaticEncode, TSchema } from 'typebox';
import Type from 'typebox';

import { CatalogStatus, Difficulty, ItemType, PathVisibility } from './enums.js';
import { IsoDate, NullableIsoDate, TrimmedText, Uuid } from './primitives.js';

/*
 * The learning catalog, managed by admins: LearningPath → Module → Topic → (linked) Item.
 * Items are shared study material; one item can be linked to many topics.
 */

// ---------- Shared fields ----------

/** "two-pointers": lowercase letters and numbers separated by single dashes. */
export const Slug = () =>
    Type.String( {
        maxLength: 120,
        pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
        errorMessage: 'must be lowercase letters and numbers separated by dashes, e.g. "two-pointers"',
        examples: [ 'two-pointers' ],
    } );

const Description = () => Type.Union( [ Type.String( { maxLength: 5000 } ), Type.Null() ] );

const HttpUrl = () =>
    Type.String( {
        maxLength: 2048,
        pattern: '^https?://\\S+$',
        errorMessage: 'must be an http(s) URL',
        examples: [ 'https://leetcode.com/problems/two-sum' ],
    } );

const Markdown = ( maxLength: number ) => Type.String( { minLength: 1, maxLength } );

/** Fields every path, module and topic has. */
const NodeFields = {
    id: Uuid(),
    title: Type.String( { examples: [ 'Two Pointers' ] } ),
    slug: Type.String( { examples: [ 'two-pointers' ] } ),
    description: Type.Union( [ Type.String(), Type.Null() ] ),
    status: Type.Enum( CatalogStatus ),
    position: Type.Integer( { description: 'Order among its siblings, ascending' } ),
    createdAt: IsoDate(),
    updatedAt: IsoDate(),
};

// ---------- Item details: one schema per item type ----------

export const ProblemDetails = Type.Object(
    {
        url: HttpUrl(),
        platform: Type.Optional( Type.String( { maxLength: 50, examples: [ 'leetcode' ] } ) ),
    },
    { additionalProperties: false },
);

export const ArticleDetails = Type.Object( { url: HttpUrl() }, { additionalProperties: false } );

export const VideoDetails = Type.Object(
    {
        url: HttpUrl(),
        durationMinutes: Type.Optional( Type.Integer( { minimum: 1, maximum: 10_000 } ) ),
    },
    { additionalProperties: false },
);

export const BookDetails = Type.Object(
    {
        author: Type.Optional( Type.String( { maxLength: 200, examples: [ 'Cormen et al.' ] } ) ),
        chapters: Type.Optional( Type.String( { maxLength: 200, examples: [ 'Ch. 2.3' ] } ) ),
        isbn: Type.Optional( Type.String( { maxLength: 20 } ) ),
        url: Type.Optional( HttpUrl() ),
    },
    { additionalProperties: false },
);

export const CourseDetails = Type.Object(
    {
        url: HttpUrl(),
        provider: Type.Optional( Type.String( { maxLength: 100, examples: [ 'NestJS Official' ] } ) ),
    },
    { additionalProperties: false },
);

export const NoteDetails = Type.Object(
    { content: Markdown( 50_000 ) },
    { additionalProperties: false, description: 'Markdown written by the admin' },
);

export const ExerciseDetails = Type.Object(
    {
        instructions: Markdown( 20_000 ),
        answer: Type.Optional( Markdown( 20_000 ) ),
    },
    { additionalProperties: false },
);

/**
 * The `details` schema for each item type. Adding a type means adding a schema here (and to `ItemType`),
 * not a database migration.
 */
export const ItemDetailsSchemas = {
    [ItemType.Problem]: ProblemDetails,
    [ItemType.Article]: ArticleDetails,
    [ItemType.Video]: VideoDetails,
    [ItemType.Book]: BookDetails,
    [ItemType.Course]: CourseDetails,
    [ItemType.Note]: NoteDetails,
    [ItemType.Exercise]: ExerciseDetails,
} as const satisfies Record<ItemType, TSchema>;

export type ItemDetails = StaticDecode<( typeof ItemDetailsSchemas )[ItemType]>;

// `details` is checked against the schema for the item's type by the API, which reports errors per field.
const DetailsInput = () =>
    Type.Record( Type.String(), Type.Unknown(), {
        description: 'Depends on `type`: see ProblemDetails, ArticleDetails, VideoDetails, BookDetails, '
            + 'CourseDetails, NoteDetails, ExerciseDetails',
        examples: [ { url: 'https://leetcode.com/problems/two-sum', platform: 'leetcode' } ],
    } );

// ---------- Responses ----------

export const LearningPath = Type.Object( {
    ...NodeFields,
    title: Type.String( { examples: [ 'Data Structures & Algorithms' ] } ),
    slug: Type.String( { examples: [ 'dsa' ] } ),
    organizationId: Type.Union( [ Uuid(), Type.Null() ], {
        description: 'Null for the global catalog; otherwise the organization (e.g. personal workspace) that owns it',
    } ),
    visibility: Type.Enum( PathVisibility ),
    publicBlockedAt: NullableIsoDate( {
        description: 'Set when a moderator took the path out of the public catalog; it can\'t be made public again',
    } ),
} );
export type LearningPath = StaticDecode<typeof LearningPath>;
export type LearningPathJson = StaticEncode<typeof LearningPath>;

export const LearningModule = Type.Object( {
    ...NodeFields,
    title: Type.String( { examples: [ 'Arrays & Hashing' ] } ),
    slug: Type.String( { examples: [ 'arrays-and-hashing' ] } ),
    learningPathId: Uuid(),
} );
export type LearningModule = StaticDecode<typeof LearningModule>;

export const Topic = Type.Object( { ...NodeFields, moduleId: Uuid() } );
export type Topic = StaticDecode<typeof Topic>;

export const Item = Type.Object( {
    id: Uuid(),
    organizationId: Type.Union( [ Uuid(), Type.Null() ], { description: 'Null for the global catalog' } ),
    type: Type.Enum( ItemType ),
    title: Type.String( { examples: [ 'Two Sum II - Input Array Is Sorted' ] } ),
    description: Type.Union( [ Type.String(), Type.Null() ] ),
    difficulty: Type.Union( [ Type.Enum( Difficulty ), Type.Null() ] ),
    estimatedMinutes: Type.Union( [ Type.Integer(), Type.Null() ] ),
    tags: Type.Array( Type.String(), { examples: [ [ 'array', 'two-pointers' ] ] } ),
    details: Type.Record( Type.String(), Type.Unknown(), { description: 'Depends on `type`' } ),
    status: Type.Enum( CatalogStatus ),
    createdAt: IsoDate(),
    updatedAt: IsoDate(),
} );
export type Item = StaticDecode<typeof Item>;
export type ItemJson = StaticEncode<typeof Item>;

/** An item as its catalog's managers list it: also how many topics use it. */
export const ManagedItem = Type.Object( {
    ...Item.properties,
    topicCount: Type.Integer( { description: 'Topics it is placed in, in any path' } ),
} );
export type ManagedItem = StaticDecode<typeof ManagedItem>;
export type ManagedItemJson = StaticEncode<typeof ManagedItem>;

export const ManagedItemPage = Type.Object( {
    items: Type.Array( ManagedItem ),
    total: Type.Integer( { description: 'Matching items across all pages' } ),
} );
export type ManagedItemPage = StaticDecode<typeof ManagedItemPage>;
export type ManagedItemPageJson = StaticEncode<typeof ManagedItemPage>;

export const ItemPage = Type.Object( {
    items: Type.Array( Item ),
    total: Type.Integer( { description: 'Matching items across all pages' } ),
} );
export type ItemPage = StaticDecode<typeof ItemPage>;
export type ItemPageJson = StaticEncode<typeof ItemPage>;

/** An item as placed in a topic. */
export const TopicItem = Type.Object( {
    ...Item.properties,
    position: Type.Integer( { description: 'Order within the topic, ascending' } ),
    isOptional: Type.Boolean( { description: 'Extra material; not needed to complete the topic' } ),
} );
export type TopicItem = StaticDecode<typeof TopicItem>;

export const TopicTree = Type.Object( { ...Topic.properties, items: Type.Array( TopicItem ) } );
export type TopicTree = StaticDecode<typeof TopicTree>;

export const LearningModuleTree = Type.Object( { ...LearningModule.properties, topics: Type.Array( TopicTree ) } );
export type LearningModuleTree = StaticDecode<typeof LearningModuleTree>;

/** A path as its catalog's managers list it, with what's in it (drafts included). */
export const ManagedLearningPath = Type.Object( {
    ...LearningPath.properties,
    moduleCount: Type.Integer(),
    itemCount: Type.Integer( { description: 'Items in its topics, each counted once' } ),
} );
export type ManagedLearningPath = StaticDecode<typeof ManagedLearningPath>;
export type ManagedLearningPathJson = StaticEncode<typeof ManagedLearningPath>;

/** A whole path with everything under it, in order, including drafts and archived content. */
export const LearningPathTree = Type.Object( {
    ...LearningPath.properties,
    modules: Type.Array( LearningModuleTree ),
} );
export type LearningPathTree = StaticDecode<typeof LearningPathTree>;
export type LearningPathTreeJson = StaticEncode<typeof LearningPathTree>;

// ---------- Requests ----------

const NodeInput = ( titleExamples: string[] ) => ( {
    title: TrimmedText( 200, titleExamples ),
    slug: Type.Optional( Slug() ),
    description: Type.Optional( Description() ),
    status: Type.Optional( Type.Enum( CatalogStatus, {
        description: 'Default: draft in the global catalog, published in an organization',
    } ) ),
} );

export const CreateLearningPathRequest = Type.Object(
    {
        ...NodeInput( [ 'Data Structures & Algorithms' ] ),
        visibility: Type.Optional( Type.Enum( PathVisibility, {
            description: 'Only for paths in a personal workspace (default: private). Global paths are always public; '
                + 'paths in a shared organization are visible to its members only.',
        } ) ),
    },
    { additionalProperties: false, description: 'The slug is generated from the title when omitted' },
);
export type CreateLearningPathRequest = StaticDecode<typeof CreateLearningPathRequest>;

export const UpdateLearningPathRequest = Type.Partial( CreateLearningPathRequest );
export type UpdateLearningPathRequest = StaticDecode<typeof UpdateLearningPathRequest>;

export const CreateLearningModuleRequest = Type.Object(
    NodeInput( [ 'Arrays & Hashing' ] ),
    { additionalProperties: false, description: 'The slug is generated from the title when omitted' },
);
export type CreateLearningModuleRequest = StaticDecode<typeof CreateLearningModuleRequest>;

export const UpdateLearningModuleRequest = Type.Partial( CreateLearningModuleRequest );
export type UpdateLearningModuleRequest = StaticDecode<typeof UpdateLearningModuleRequest>;

export const CreateTopicRequest = Type.Object(
    NodeInput( [ 'Two Pointers' ] ),
    { additionalProperties: false, description: 'The slug is generated from the title when omitted' },
);
export type CreateTopicRequest = StaticDecode<typeof CreateTopicRequest>;

export const UpdateTopicRequest = Type.Partial( CreateTopicRequest );
export type UpdateTopicRequest = StaticDecode<typeof UpdateTopicRequest>;

const ItemInput = {
    title: TrimmedText( 300, [ 'Two Sum II - Input Array Is Sorted' ] ),
    description: Type.Optional( Description() ),
    difficulty: Type.Optional( Type.Union( [ Type.Enum( Difficulty ), Type.Null() ] ) ),
    estimatedMinutes: Type.Optional( Type.Union( [ Type.Integer( { minimum: 1, maximum: 10_000 } ), Type.Null() ] ) ),
    tags: Type.Optional( Type.Array(
        Type.String( { minLength: 1, maxLength: 50 } ),
        { maxItems: 20, uniqueItems: true },
    ) ),
    details: DetailsInput(),
    status: Type.Optional( Type.Enum( CatalogStatus, {
        description: 'Default: draft in the global catalog, published in an organization',
    } ) ),
};

export const CreateItemRequest = Type.Object(
    { type: Type.Enum( ItemType ), ...ItemInput },
    { additionalProperties: false },
);
export type CreateItemRequest = StaticDecode<typeof CreateItemRequest>;

/** The type can't change; `details` is replaced as a whole and checked against the item's type. */
export const UpdateItemRequest = Type.Partial( Type.Object( ItemInput, { additionalProperties: false } ) );
export type UpdateItemRequest = StaticDecode<typeof UpdateItemRequest>;

export const ListItemsQuery = Type.Object(
    {
        type: Type.Optional( Type.Enum( ItemType ) ),
        status: Type.Optional( Type.Enum( CatalogStatus ) ),
        search: Type.Optional( Type.String( { minLength: 1, maxLength: 100, description: 'Matches the title' } ) ),
        tag: Type.Optional( Type.String( { minLength: 1, maxLength: 50 } ) ),
        limit: Type.Optional( Type.Integer( { minimum: 1, maximum: 200, default: 50 } ) ),
        offset: Type.Optional( Type.Integer( { minimum: 0, default: 0 } ) ),
    },
    { additionalProperties: false },
);
export type ListItemsQuery = StaticDecode<typeof ListItemsQuery>;

export const LinkItemRequest = Type.Object(
    { isOptional: Type.Optional( Type.Boolean( { description: 'Default: false' } ) ) },
    { additionalProperties: false },
);
export type LinkItemRequest = StaticDecode<typeof LinkItemRequest>;

/** The new order of a parent's children: every child id exactly once. */
export const ReorderRequest = Type.Object(
    { ids: Type.Array( Uuid(), { uniqueItems: true, maxItems: 1000 } ) },
    { additionalProperties: false },
);
export type ReorderRequest = StaticDecode<typeof ReorderRequest>;

// ---------- Importing a path file ----------

/** The longest path file the API takes: well over the biggest one so far (about 35,000), under the JSON body limit. */
export const MAX_PATH_FILE_LENGTH = 90_000;

/** A learning-path YAML file (content/paths/README.md), for the global catalog. */
export const ImportPathFileRequest = Type.Object(
    {
        content: Type.String( { minLength: 1, maxLength: MAX_PATH_FILE_LENGTH, description: 'The file\'s text' } ),
        dryRun: Type.Optional( Type.Boolean( { description: 'Check the file and say what would change, saving nothing' } ) ),
    },
    { additionalProperties: false },
);
export type ImportPathFileRequest = StaticDecode<typeof ImportPathFileRequest>;

const Changes = {
    total: Type.Integer( { minimum: 0, description: 'How many the file has' } ),
    created: Type.Integer( { minimum: 0 } ),
    updated: Type.Integer( { minimum: 0 } ),
};

/** What an import changed, or on a dry run would change. */
export const PathImportResult = Type.Object( {
    dryRun: Type.Boolean(),
    path: Type.Object( {
        id: Uuid(),
        slug: Type.String(),
        title: Type.String(),
        status: Type.Enum( CatalogStatus, { description: 'A new path is a draft until it\'s published' } ),
        created: Type.Boolean(),
        updated: Type.Boolean( { description: 'An existing path whose title or description changed' } ),
    }, { description: 'On a dry run of a new path, the id was never saved' } ),
    modules: Type.Object( Changes ),
    topics: Type.Object( Changes ),
    items: Type.Object( {
        ...Changes,
        total: Type.Integer( { minimum: 0, description: 'Distinct items: one used in two topics counts once' } ),
        linked: Type.Integer( { minimum: 0, description: 'Placed in a topic' } ),
        unlinked: Type.Integer( { minimum: 0, description: 'Taken out of a topic that no longer lists them' } ),
    } ),
    notInFile: Type.Array( Type.String(), { description: 'Modules and topics no longer in the file: kept, delete them here if you mean to' } ),
    unpublishedItems: Type.Array( Type.String(), { description: 'Items in the path learners can\'t see (a draft or archived)' } ),
} );
export type PathImportResult = StaticDecode<typeof PathImportResult>;
export type PathImportResultJson = StaticEncode<typeof PathImportResult>;
