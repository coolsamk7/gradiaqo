import {
    CatalogStatus,
    Difficulty,
    EnrollmentStatus,
    ItemType,
    OrganizationRole,
    PathVisibility,
    PlatformRole,
    ReportReason,
    ReportStatus,
    toSlug,
} from '@studylog/database';

/*
 * What `db:seed` puts in the database, written as plain data. `seed-data.ts` turns it into rows with ids,
 * dates and relations.
 */

/** Everyone's password in the dummy data. */
export const SEED_PASSWORD = 'password123';

export type UserKey = 'admin' | 'alice' | 'bob' | 'carol' | 'dave';

export interface UserSpec {
    key: UserKey;
    firstName: string;
    lastName: string;
    email: string;
    platformRole: PlatformRole;
    /** Signed up this many days ago. */
    joinedDaysAgo: number;
}

export const USERS: UserSpec[] = [
    { key: 'admin', firstName: 'Ada', lastName: 'Admin', email: 'admin@example.com', platformRole: PlatformRole.Superadmin, joinedDaysAgo: 90 },
    { key: 'alice', firstName: 'Alice', lastName: 'Walker', email: 'alice@example.com', platformRole: PlatformRole.ApplicationUser, joinedDaysAgo: 60 },
    { key: 'bob', firstName: 'Bob', lastName: 'Singh', email: 'bob@example.com', platformRole: PlatformRole.ApplicationUser, joinedDaysAgo: 45 },
    { key: 'carol', firstName: 'Carol', lastName: 'Nguyen', email: 'carol@example.com', platformRole: PlatformRole.ApplicationUser, joinedDaysAgo: 30 },
    { key: 'dave', firstName: 'Dave', lastName: 'Okafor', email: 'dave@example.com', platformRole: PlatformRole.ApplicationUser, joinedDaysAgo: 7 },
];

/** A shared organization (besides everyone's personal workspace). */
export const TEAM = {
    name: 'Acme Study Group',
    slug: 'acme-study-group',
    createdBy: 'alice' as UserKey,
    members: [
        { user: 'alice' as UserKey, role: OrganizationRole.Owner },
        { user: 'bob' as UserKey, role: OrganizationRole.Admin },
        { user: 'carol' as UserKey, role: OrganizationRole.Member },
    ],
    // Dave has an account; the second person hasn't signed up yet.
    invitations: [
        { email: 'dave@example.com', role: OrganizationRole.Member },
        { email: 'newcomer@example.com', role: OrganizationRole.Admin },
    ],
};

/** Whose catalog something is in: the global one, the team's, or Alice's personal workspace. */
export type CatalogOwner = 'global' | 'team' | 'alice';

export interface ItemSpec {
    owner: CatalogOwner;
    type: ItemType;
    title: string;
    difficulty?: Difficulty;
    estimatedMinutes?: number;
    tags?: string[];
    details: Record<string, unknown>;
    status?: CatalogStatus;
}

const leetcode = ( title: string, difficulty: Difficulty, estimatedMinutes: number, tags: string[] ): ItemSpec => ( {
    owner: 'global',
    type: ItemType.Problem,
    title,
    difficulty,
    estimatedMinutes,
    tags,
    details: { url: `https://leetcode.com/problems/${toSlug( title )}/`, platform: 'leetcode' },
} );

const article = ( title: string, url: string, estimatedMinutes: number, tags: string[] = [] ): ItemSpec => (
    { owner: 'global', type: ItemType.Article, title, estimatedMinutes, tags, details: { url } }
);

const video = ( title: string, url: string, durationMinutes: number, tags: string[] = [] ): ItemSpec => (
    { owner: 'global', type: ItemType.Video, title, estimatedMinutes: durationMinutes, tags, details: { url, durationMinutes } }
);

/** Every item, by key. Topics link items by these keys, so one item can appear in several topics and paths. */
export const ITEMS = {
    // Arrays & hashing
    twoSum: leetcode( 'Two Sum', Difficulty.Easy, 15, [ 'array', 'hash-table' ] ),
    containsDuplicate: leetcode( 'Contains Duplicate', Difficulty.Easy, 10, [ 'array', 'hash-table' ] ),
    groupAnagrams: leetcode( 'Group Anagrams', Difficulty.Medium, 25, [ 'string', 'hash-table' ] ),
    hashTables: article( 'Hash Tables Explained', 'https://en.wikipedia.org/wiki/Hash_table', 20, [ 'hash-table' ] ),
    validPalindrome: leetcode( 'Valid Palindrome', Difficulty.Easy, 10, [ 'string', 'two-pointers' ] ),
    threeSum: leetcode( '3Sum', Difficulty.Medium, 35, [ 'array', 'two-pointers' ] ),
    mostWater: leetcode( 'Container With Most Water', Difficulty.Medium, 25, [ 'array', 'two-pointers' ] ),
    twoPointersVideo: video( 'The Two Pointers Technique', 'https://www.youtube.com/watch?v=On03HWe2tZM', 12, [ 'two-pointers' ] ),
    buySellStock: leetcode( 'Best Time to Buy and Sell Stock', Difficulty.Easy, 15, [ 'array', 'sliding-window' ] ),
    longestSubstring: leetcode( 'Longest Substring Without Repeating Characters', Difficulty.Medium, 30, [ 'string', 'sliding-window' ] ),
    minWindow: leetcode( 'Minimum Window Substring', Difficulty.Hard, 45, [ 'string', 'sliding-window' ] ),
    // Linked lists
    reverseList: leetcode( 'Reverse Linked List', Difficulty.Easy, 15, [ 'linked-list' ] ),
    mergeLists: leetcode( 'Merge Two Sorted Lists', Difficulty.Easy, 15, [ 'linked-list' ] ),
    dummyHead: {
        owner: 'global',
        type: ItemType.Note,
        title: 'The Dummy Head Trick',
        estimatedMinutes: 5,
        tags: [ 'linked-list' ],
        details: {
            content: 'Start with a `dummy` node pointing at `head`, work on `dummy.next`, and return `dummy.next`.\n\n'
                + 'No special case for changing the first node.',
        },
    },
    listCycle: leetcode( 'Linked List Cycle', Difficulty.Easy, 15, [ 'linked-list', 'two-pointers' ] ),
    reorderList: leetcode( 'Reorder List', Difficulty.Medium, 30, [ 'linked-list', 'two-pointers' ] ),
    // Trees
    maxDepth: leetcode( 'Maximum Depth of Binary Tree', Difficulty.Easy, 10, [ 'tree', 'dfs' ] ),
    levelOrder: leetcode( 'Binary Tree Level Order Traversal', Difficulty.Medium, 20, [ 'tree', 'bfs' ] ),
    iterativeInorder: {
        owner: 'global',
        type: ItemType.Exercise,
        title: 'Iterative Inorder Traversal',
        difficulty: Difficulty.Medium,
        estimatedMinutes: 20,
        tags: [ 'tree', 'stack' ],
        details: {
            instructions: 'Write an inorder traversal of a binary tree **without recursion**.',
            answer: 'Push left children onto a stack; pop, visit, then move to the right child. Repeat until both are empty.',
        },
    },
    validateBst: leetcode( 'Validate Binary Search Tree', Difficulty.Medium, 25, [ 'tree', 'bst' ] ),
    kthSmallest: leetcode( 'Kth Smallest Element in a BST', Difficulty.Medium, 20, [ 'tree', 'bst' ] ),
    clrs: {
        owner: 'global',
        type: ItemType.Book,
        title: 'Introduction to Algorithms: Binary Search Trees',
        estimatedMinutes: 90,
        tags: [ 'tree', 'bst' ],
        details: { author: 'Cormen et al.', chapters: 'Ch. 12', isbn: '9780262046305' },
    },
    // Dynamic programming
    climbingStairs: leetcode( 'Climbing Stairs', Difficulty.Easy, 10, [ 'dp' ] ),
    houseRobber: leetcode( 'House Robber', Difficulty.Medium, 20, [ 'dp' ] ),
    coinChange: leetcode( 'Coin Change', Difficulty.Medium, 30, [ 'dp' ] ),
    dpVideo: video( 'Dynamic Programming for Beginners', 'https://www.youtube.com/watch?v=oBt53YbR9Kk', 300, [ 'dp' ] ),
    uniquePaths: leetcode( 'Unique Paths', Difficulty.Medium, 20, [ 'dp', 'grid' ] ),
    lcs: leetcode( 'Longest Common Subsequence', Difficulty.Medium, 30, [ 'dp', 'string' ] ),
    editDistance: leetcode( 'Edit Distance', Difficulty.Hard, 45, [ 'dp', 'string' ] ),
    // Graphs (draft path)
    numberOfIslands: { ...leetcode( 'Number of Islands', Difficulty.Medium, 25, [ 'graph', 'bfs' ] ), status: CatalogStatus.Draft },
    // System design
    scalability: article( 'Scalability for Dummies', 'https://www.lecloud.net/tagged/scalability', 30, [ 'scalability' ] ),
    scalabilityLecture: video( 'Scalability Lecture (Harvard CS75)', 'https://www.youtube.com/watch?v=-W9F__D3oY4', 60, [ 'scalability' ] ),
    ddia: {
        owner: 'global',
        type: ItemType.Book,
        title: 'Designing Data-Intensive Applications',
        estimatedMinutes: 600,
        tags: [ 'databases', 'distributed-systems' ],
        details: { author: 'Martin Kleppmann', chapters: 'Ch. 1-3' },
    },
    caching: article( 'Caching Strategies', 'https://aws.amazon.com/caching/best-practices/', 20, [ 'caching' ] ),
    designCache: {
        owner: 'global',
        type: ItemType.Exercise,
        title: 'Design an LRU Cache',
        difficulty: Difficulty.Medium,
        estimatedMinutes: 40,
        tags: [ 'caching' ],
        details: { instructions: 'Design a cache with `get` and `put` in O(1), evicting the least recently used entry.' },
    },
    sharding: article( 'Database Sharding', 'https://en.wikipedia.org/wiki/Shard_(database_architecture)', 20, [ 'databases' ] ),
    cap: video( 'CAP Theorem Simplified', 'https://www.youtube.com/watch?v=BHqjEjzAicA', 10, [ 'distributed-systems' ] ),
    distributedCourse: {
        owner: 'global',
        type: ItemType.Course,
        title: 'Distributed Systems (MIT 6.824)',
        estimatedMinutes: 1200,
        tags: [ 'distributed-systems' ],
        details: { url: 'https://pdos.csail.mit.edu/6.824/', provider: 'MIT' },
    },
    // The team's own material
    sprintRules: {
        owner: 'team',
        type: ItemType.Note,
        title: 'How Our Sprint Works',
        estimatedMinutes: 5,
        details: { content: '- One topic a week\n- Post your solutions in the channel\n- Mock interviews on Fridays' },
    },
    mockInterview: {
        owner: 'team',
        type: ItemType.Exercise,
        title: 'Mock Interview: Arrays',
        difficulty: Difficulty.Medium,
        estimatedMinutes: 45,
        details: { instructions: 'Pair up. One person interviews with a problem from this week, then swap.' },
    },
    // Alice's own material
    aliceNotes: {
        owner: 'alice',
        type: ItemType.Note,
        title: 'My Pattern Cheat Sheet',
        estimatedMinutes: 10,
        details: { content: 'Sorted input? Two pointers. Contiguous range? Sliding window. Counting? Hash map.' },
    },
} satisfies Record<string, ItemSpec>;

export type ItemKey = keyof typeof ITEMS;

export interface TopicSpec {
    title: string;
    description?: string;
    items: ItemKey[];
    /** Items that are extra material, not needed to complete the topic. */
    optional?: ItemKey[];
}

export interface ModuleSpec {
    title: string;
    description?: string;
    topics: TopicSpec[];
}

export type PathKey = 'dsa' | 'systemDesign' | 'graphs' | 'teamSprint' | 'alicePicks';

export interface PathSpec {
    key: PathKey;
    owner: CatalogOwner;
    title: string;
    description: string;
    status: CatalogStatus;
    visibility: PathVisibility;
    createdBy: UserKey;
    modules: ModuleSpec[];
}

export const PATHS: PathSpec[] = [
    {
        key: 'dsa',
        owner: 'global',
        title: 'Data Structures & Algorithms',
        description: 'The classic interview patterns, one module at a time.',
        status: CatalogStatus.Published,
        visibility: PathVisibility.Public,
        createdBy: 'admin',
        modules: [
            {
                title: 'Arrays & Hashing',
                description: 'Most problems start here.',
                topics: [
                    { title: 'Hashing Basics', items: [ 'twoSum', 'containsDuplicate', 'groupAnagrams', 'hashTables' ], optional: [ 'hashTables' ] },
                    { title: 'Two Pointers', items: [ 'validPalindrome', 'threeSum', 'mostWater', 'twoPointersVideo' ], optional: [ 'twoPointersVideo' ] },
                    { title: 'Sliding Window',
                        description: 'A window over a contiguous range that grows and shrinks as you go.',
                        items: [ 'buySellStock', 'longestSubstring', 'minWindow' ] },
                ],
            },
            {
                title: 'Linked Lists',
                topics: [
                    { title: 'Linked List Basics', items: [ 'reverseList', 'mergeLists', 'dummyHead' ] },
                    { title: 'Fast & Slow Pointers', items: [ 'listCycle', 'reorderList' ] },
                ],
            },
            {
                title: 'Trees',
                topics: [
                    { title: 'Tree Traversals', items: [ 'maxDepth', 'levelOrder', 'iterativeInorder' ] },
                    { title: 'Binary Search Trees', items: [ 'validateBst', 'kthSmallest', 'clrs' ], optional: [ 'clrs' ] },
                ],
            },
            {
                title: 'Dynamic Programming',
                description: 'Break a problem into overlapping subproblems.',
                topics: [
                    { title: '1-D DP', items: [ 'climbingStairs', 'houseRobber', 'coinChange', 'dpVideo' ], optional: [ 'dpVideo' ] },
                    { title: '2-D DP', items: [ 'uniquePaths', 'lcs', 'editDistance' ] },
                ],
            },
        ],
    },
    {
        key: 'systemDesign',
        owner: 'global',
        title: 'System Design Fundamentals',
        description: 'How large systems stay fast and available.',
        status: CatalogStatus.Published,
        visibility: PathVisibility.Public,
        createdBy: 'admin',
        modules: [
            {
                title: 'Foundations',
                topics: [
                    { title: 'Scalability', items: [ 'scalability', 'scalabilityLecture', 'ddia' ], optional: [ 'ddia' ] },
                    { title: 'Caching', items: [ 'caching', 'designCache' ] },
                ],
            },
            {
                title: 'Data at Scale',
                topics: [
                    { title: 'Databases & Sharding', items: [ 'sharding', 'ddia' ] },
                    { title: 'Consistency', items: [ 'cap', 'distributedCourse' ], optional: [ 'distributedCourse' ] },
                ],
            },
        ],
    },
    {
        // Still being written: only admins see it.
        key: 'graphs',
        owner: 'global',
        title: 'Graph Algorithms',
        description: 'BFS, DFS, shortest paths and more. Coming soon.',
        status: CatalogStatus.Draft,
        visibility: PathVisibility.Public,
        createdBy: 'admin',
        modules: [ { title: 'Graph Traversal', topics: [ { title: 'Grids', items: [ 'numberOfIslands' ] } ] } ],
    },
    {
        key: 'teamSprint',
        owner: 'team',
        title: 'Interview Sprint',
        description: 'Our four-week prep plan, reusing problems from the global catalog.',
        status: CatalogStatus.Published,
        visibility: PathVisibility.Private,
        createdBy: 'alice',
        modules: [
            {
                title: 'Week 1',
                topics: [
                    { title: 'Warm-up', items: [ 'sprintRules', 'twoSum', 'validPalindrome', 'buySellStock' ] },
                    { title: 'Mock Interview', items: [ 'mockInterview' ] },
                ],
            },
        ],
    },
    {
        // Shared from a personal workspace: shows up in the public catalog, and Bob has reported it.
        key: 'alicePicks',
        owner: 'alice',
        title: 'Alice\'s Favourite Problems',
        description: 'The problems that taught me the most.',
        status: CatalogStatus.Published,
        visibility: PathVisibility.Public,
        createdBy: 'alice',
        modules: [
            {
                title: 'Favourites',
                topics: [ { title: 'Must Do', items: [ 'aliceNotes', 'twoSum', 'threeSum', 'coinChange' ] } ],
            },
        ],
    },
];

export interface EnrollmentSpec {
    user: UserKey;
    path: PathKey;
    status: EnrollmentStatus;
    /** Share of the enrolled items already done, from the start of the path. */
    done: number;
    /** Modules (by title) left out of the enrollment. */
    excludeModules?: string[];
    /** The user's own order for the first module's topics (by title). */
    firstModuleOrder?: string[];
}

export const ENROLLMENTS: EnrollmentSpec[] = [
    {
        user: 'alice',
        path: 'dsa',
        status: EnrollmentStatus.Active,
        done: 0.6,
        excludeModules: [ 'Dynamic Programming' ],
        firstModuleOrder: [ 'Sliding Window', 'Hashing Basics', 'Two Pointers' ],
    },
    { user: 'alice', path: 'teamSprint', status: EnrollmentStatus.Completed, done: 1 },
    { user: 'bob', path: 'dsa', status: EnrollmentStatus.Active, done: 0.3 },
    { user: 'bob', path: 'systemDesign', status: EnrollmentStatus.Paused, done: 0.2 },
    { user: 'carol', path: 'teamSprint', status: EnrollmentStatus.Active, done: 0.4 },
    { user: 'carol', path: 'alicePicks', status: EnrollmentStatus.Active, done: 0.25 },
];

/** How often each user studied over the last 30 days (share of days with at least one session). */
export const ACTIVITY: Partial<Record<UserKey, number>> = { alice: 0.8, bob: 0.5, carol: 0.4 };

export const REPORTS = [
    {
        path: 'alicePicks' as PathKey,
        reporter: 'carol' as UserKey,
        reason: ReportReason.Spam,
        details: 'Looks like a copy of the global path.',
        status: ReportStatus.Dismissed,
        resolutionNote: 'A personal selection, not a copy. Nothing to do.',
    },
    {
        path: 'alicePicks' as PathKey,
        reporter: 'bob' as UserKey,
        reason: ReportReason.Other,
        details: 'One of the links is broken.',
        status: ReportStatus.Open,
        resolutionNote: null,
    },
];
