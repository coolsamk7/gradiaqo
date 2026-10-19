import type { CreateItemRequest } from '@studylog/schemas';
import { Difficulty, ItemType } from '@studylog/schemas/enums';

import type { FieldErrors } from '../../forms/form-errors.ts';

/*
 * The "New item" form of the path builder (Figma: M4 · Path builder): the fields every item has, plus the details
 * its type needs (see ItemDetailsSchemas).
 */

export type ItemField =
    | 'title' | 'url' | 'author' | 'provider' | 'content' | 'instructions' | 'answer' | 'difficulty' | 'minutes';
export type ItemValues = Record<ItemField, string> & { type: ItemType };
type DetailField = Exclude<ItemField, 'title' | 'difficulty' | 'minutes'>;

export interface DetailInput {
    field: DetailField;
    label: string;
    required: boolean;
    /** A multi-line box instead of a one-line input. */
    long?: boolean;
}

const link = ( required: boolean ): DetailInput => ( { field: 'url', label: required ? 'Link' : 'Link (optional)', required } );

/** The details each type asks for, in form order. */
export const DETAIL_INPUTS: Record<ItemType, DetailInput[]> = {
    [ItemType.Problem]: [ link( true ) ],
    [ItemType.Article]: [ link( true ) ],
    [ItemType.Video]: [ link( true ) ],
    [ItemType.Course]: [ link( true ), { field: 'provider', label: 'Provider (optional)', required: false } ],
    [ItemType.Book]: [ { field: 'author', label: 'Author (optional)', required: false }, link( false ) ],
    [ItemType.Note]: [ { field: 'content', label: 'Note', required: true, long: true } ],
    [ItemType.Exercise]: [
        { field: 'instructions', label: 'Instructions', required: true, long: true },
        { field: 'answer', label: 'Answer (optional)', required: false, long: true },
    ],
};

/** Types where a difficulty makes sense. */
export const HAS_DIFFICULTY: ReadonlySet<ItemType> = new Set( [ ItemType.Problem, ItemType.Exercise ] );

export const DIFFICULTIES = Object.values( Difficulty );

export function emptyItem( type: ItemType = ItemType.Problem ): ItemValues {
    return {
        type,
        title: '',
        url: '',
        author: '',
        provider: '',
        content: '',
        instructions: '',
        answer: '',
        difficulty: '',
        minutes: '',
    };
}

const LABELS: Record<ItemField, string> = {
    title: 'Title',
    url: 'Link',
    author: 'Author',
    provider: 'Provider',
    content: 'Note',
    instructions: 'Instructions',
    answer: 'Answer',
    difficulty: 'Difficulty',
    minutes: 'Minutes',
};

const WEB_LINK = /^https?:\/\/\S+\.\S+$/;

/** Problems visible without asking the API, by field. */
export function checkItem( values: ItemValues ): FieldErrors<ItemField> {
    const errors: FieldErrors<ItemField> = {};

    if ( !values.title.trim() ) {
        errors.title = 'Enter a title.';
    }
    for ( const input of DETAIL_INPUTS[values.type] ) {
        const value = values[input.field].trim();

        if ( input.required && !value ) {
            errors[input.field] = `Enter ${input.field === 'url' ? 'a link' : `the ${LABELS[input.field].toLowerCase()}`}.`;
        } else if ( input.field === 'url' && value && !WEB_LINK.test( value ) ) {
            errors.url = 'Enter a full link, starting with https://';
        }
    }

    const minutes = values.minutes.trim();

    if ( minutes && !/^\d+$/.test( minutes ) ) {
        errors.minutes = 'Enter whole minutes, like 25.';
    } else if ( minutes && ( Number( minutes ) < 1 || Number( minutes ) > 10_000 ) ) {
        errors.minutes = 'Enter between 1 and 10,000 minutes.';
    }

    return errors;
}

/** The API's body for the form: only the details of the chosen type, and nothing left empty. */
export function toItemRequest( values: ItemValues ): CreateItemRequest {
    const details: Record<string, string> = {};

    for ( const { field } of DETAIL_INPUTS[values.type] ) {
        const value = values[field].trim();

        if ( value ) {
            details[field] = value;
        }
    }
    if ( values.type === ItemType.Problem ) {
        const platform = platformOf( details.url );

        if ( platform ) {
            details.platform = platform;
        }
    }

    return {
        type: values.type,
        title: values.title.trim(),
        details,
        ...( HAS_DIFFICULTY.has( values.type ) && values.difficulty
            ? { difficulty: values.difficulty as Difficulty }
            : {} ),
        ...( values.minutes.trim() ? { estimatedMinutes: Number( values.minutes ) } : {} ),
    };
}

/** The site a problem is on, from its link: "https://leetcode.com/problems/x" → "leetcode". */
export function platformOf( url: string ): string | undefined {
    const parts = URL.parse( url )?.hostname.split( '.' ) ?? [];

    return parts.length > 1 ? parts.at( -2 ) : undefined;
}

/** The API's validation errors on the form's fields ("details/url" → url), as sentences. */
export function itemFieldErrors( apiErrors: Record<string, string> ): FieldErrors<ItemField> {
    const errors: FieldErrors<ItemField> = {};

    for ( const [ path, message ] of Object.entries( apiErrors ) ) {
        const field = ( path === 'estimatedMinutes' ? 'minutes' : path.replace( /^details\//, '' ) ) as ItemField;

        if ( field in LABELS ) {
            errors[field] = `${LABELS[field]} ${message}.`;
        }
    }

    return errors;
}
