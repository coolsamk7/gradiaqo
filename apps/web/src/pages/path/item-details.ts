import { Difficulty, ItemType, ProgressStatus } from '@studylog/schemas/enums';

/*
 * How an item's type-specific `details` (see ItemDetailsSchemas) are shown. The API has validated them, but they
 * are typed loosely, so each field is checked before use.
 */

export const TYPE_LABELS: Record<ItemType, string> = {
    [ItemType.Problem]: 'Problem',
    [ItemType.Article]: 'Article',
    [ItemType.Video]: 'Video',
    [ItemType.Book]: 'Book',
    [ItemType.Course]: 'Course',
    [ItemType.Note]: 'Note',
    [ItemType.Exercise]: 'Exercise',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
    [Difficulty.Easy]: 'Easy',
    [Difficulty.Medium]: 'Medium',
    [Difficulty.Hard]: 'Hard',
};

export const STATUS_LABELS: Record<ProgressStatus, string> = {
    [ProgressStatus.NotStarted]: 'Not started',
    [ProgressStatus.InProgress]: 'In progress',
    [ProgressStatus.Done]: 'Done',
    [ProgressStatus.Revise]: 'Revise',
};

const text = ( value: unknown ): string | undefined => ( typeof value === 'string' && value !== '' ? value : undefined );

/** Where to study the item, if it lives elsewhere: the problem, article, video, course, or the book's page. */
export function itemLink( details: Record<string, unknown> ): { url: string; label: string } | undefined {
    const url = text( details.url );

    if ( !url ) {
        return undefined;
    }

    const platform = text( details.platform );

    return { url, label: platform ? `Open on ${platformName( platform )}` : 'Open' };
}

/** How platforms write their own names; others get a capital first letter ("leetcode" → "LeetCode"). */
const PLATFORM_NAMES: Record<string, string> = {
    leetcode: 'LeetCode',
    hackerrank: 'HackerRank',
    codeforces: 'Codeforces',
    geeksforgeeks: 'GeeksforGeeks',
    youtube: 'YouTube',
    neetcode: 'NeetCode',
};

function platformName( platform: string ): string {
    return PLATFORM_NAMES[platform.toLowerCase()] ?? platform.charAt( 0 ).toUpperCase() + platform.slice( 1 );
}

/** Written content shown in the app: a note's text, or an exercise's instructions and (hidden) answer. */
export function itemContent(
    type: ItemType,
    details: Record<string, unknown>,
): { body: string; answer?: string } | undefined {
    if ( type === ItemType.Note ) {
        const content = text( details.content );

        return content ? { body: content } : undefined;
    }
    if ( type === ItemType.Exercise ) {
        const instructions = text( details.instructions );

        return instructions ? { body: instructions, answer: text( details.answer ) } : undefined;
    }

    return undefined;
}

/** Facts worth a glance: a book's author and chapters, a course's provider. */
export function itemFacts( details: Record<string, unknown> ): string[] {
    return [ text( details.author ), text( details.chapters ), text( details.provider ) ]
        .filter( ( fact ): fact is string => fact !== undefined );
}
