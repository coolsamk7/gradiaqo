import type { PublishedPathSummaryJson } from '@studylog/schemas';

/** The filters above the catalog, in order: label and the API's `source` (none for all). */
export const SOURCES = [
    { label: 'All', source: undefined },
    { label: 'Official', source: 'official' },
    { label: 'Your organizations', source: 'organizations' },
    { label: 'Community', source: 'community' },
    { label: 'Yours', source: 'mine' },
] as const;

export type Source = NonNullable<( typeof SOURCES )[number]['source']>;

export const isSource = ( value: string | null ): value is Source =>
    SOURCES.some( ( option ) => option.source === value );

export type BadgeTone = 'accent' | 'neutral' | 'inverse' | 'warning';

/**
 * Where a path comes from, as its badge (Figma: Path card › Source): official paths, the user's own, a shared
 * organization's (by name), or another user's public path.
 */
export function sourceOf( path: PublishedPathSummaryJson, userId: string ): { label: string; tone: BadgeTone } {
    const { organization, createdBy } = path;

    if ( !organization ) {
        return { label: 'Official', tone: 'accent' };
    }
    if ( !organization.isPersonal ) {
        return { label: organization.name, tone: 'neutral' };
    }

    return createdBy?.id === userId ? { label: 'Yours', tone: 'inverse' } : { label: 'Community', tone: 'warning' };
}

/** The line at the bottom of the card: who made it, or where it lives. */
export function authorOf( path: PublishedPathSummaryJson, userId: string ): string {
    const { organization, createdBy } = path;
    const by = createdBy ? `by ${createdBy.firstName} ${createdBy.lastName}` : undefined;

    if ( !organization ) {
        return 'By Gradiaqo';
    }
    if ( !organization.isPersonal ) {
        return by ? `${organization.name} · ${by}` : organization.name;
    }
    if ( createdBy?.id === userId ) {
        return `Your workspace · ${path.visibility}`;
    }

    return by ? `By ${by.slice( 3 )}` : 'Community';
}

/** Roughly how long a path takes: "≈ 45m" under an hour, then whole hours ("≈ 12h"); nothing without estimates. */
export function formatEstimate( minutes: number ): string | undefined {
    if ( minutes === 0 ) {
        return undefined;
    }

    return minutes < 60 ? `≈ ${minutes}m` : `≈ ${Math.round( minutes / 60 )}h`;
}

export const count = ( amount: number, word: string ) => `${amount} ${word}${amount === 1 ? '' : 's'}`;
