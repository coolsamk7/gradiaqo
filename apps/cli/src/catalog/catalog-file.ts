import { Difficulty, ItemType } from '@studylog/database';
import { ItemDetailsSchemas } from '@studylog/schemas';
import type { StaticDecode } from 'typebox';
import Type from 'typebox';
import { Compile } from 'typebox/compile';
import { parse } from 'yaml';

import { toSlug } from '../seed/slug.js';

/*
 * A learning path written as a YAML file (content/paths/*.yaml), for `catalog:import`: the path, its modules, their
 * topics and the items in each. Unknown keys are refused, so a typo can't be silently ignored.
 */

const Slug = Type.String( { pattern: '^[a-z0-9]+(-[a-z0-9]+)*$', maxLength: 120 } );
const Text = ( maxLength: number ) => Type.String( { minLength: 1, maxLength } );

const ItemSpec = Type.Object(
    {
        /** Shorthand for a LeetCode problem: its slug, e.g. `two-sum`. Sets the type, platform and URL. */
        leetcode: Type.Optional( Slug ),
        type: Type.Optional( Type.Enum( ItemType ) ),
        title: Text( 300 ),
        description: Type.Optional( Text( 5000 ) ),
        difficulty: Type.Optional( Type.Enum( Difficulty ) ),
        minutes: Type.Optional( Type.Integer( { minimum: 1, maximum: 10_000 } ) ),
        tags: Type.Optional( Type.Array( Text( 50 ) ) ),
        /** Extra material: not needed to complete the topic. */
        optional: Type.Optional( Type.Boolean() ),
        // The item's details, by type (see ItemDetailsSchemas).
        url: Type.Optional( Type.String() ),
        platform: Type.Optional( Type.String() ),
        durationMinutes: Type.Optional( Type.Integer() ),
        author: Type.Optional( Type.String() ),
        chapters: Type.Optional( Type.String() ),
        isbn: Type.Optional( Type.String() ),
        provider: Type.Optional( Type.String() ),
        content: Type.Optional( Type.String() ),
        instructions: Type.Optional( Type.String() ),
        answer: Type.Optional( Type.String() ),
    },
    { additionalProperties: false },
);

const TopicSpec = Type.Object(
    {
        title: Text( 200 ),
        /** Defaults to the title as a slug. Changing a title keeps the slug, so give one to rename safely. */
        slug: Type.Optional( Slug ),
        description: Type.Optional( Text( 5000 ) ),
        items: Type.Array( ItemSpec, { minItems: 1 } ),
    },
    { additionalProperties: false },
);

const ModuleSpec = Type.Object(
    {
        title: Text( 200 ),
        slug: Type.Optional( Slug ),
        description: Type.Optional( Text( 5000 ) ),
        topics: Type.Array( TopicSpec, { minItems: 1 } ),
    },
    { additionalProperties: false },
);

export const PathFile = Type.Object(
    {
        slug: Slug,
        title: Text( 200 ),
        description: Type.Optional( Text( 5000 ) ),
        modules: Type.Array( ModuleSpec, { minItems: 1 } ),
    },
    { additionalProperties: false },
);
type ItemSpecValue = StaticDecode<typeof ItemSpec>;

/** Which keys of an item spec belong in `details` for each type. */
const DETAIL_KEYS: Record<ItemType, ( keyof ItemSpecValue )[]> = {
    [ItemType.Problem]: [ 'url', 'platform' ],
    [ItemType.Article]: [ 'url' ],
    [ItemType.Video]: [ 'url', 'durationMinutes' ],
    [ItemType.Book]: [ 'author', 'chapters', 'isbn', 'url' ],
    [ItemType.Course]: [ 'url', 'provider' ],
    [ItemType.Note]: [ 'content' ],
    [ItemType.Exercise]: [ 'instructions', 'answer' ],
};

export interface CatalogItem {
    type: ItemType;
    title: string;
    description: string | null;
    difficulty: Difficulty | null;
    estimatedMinutes: number | null;
    tags: string[];
    details: Record<string, unknown>;
    isOptional: boolean;
}

export interface CatalogTopic {
    slug: string;
    title: string;
    description: string | null;
    items: CatalogItem[];
}

export interface CatalogModule {
    slug: string;
    title: string;
    description: string | null;
    topics: CatalogTopic[];
}

export interface CatalogPath {
    slug: string;
    title: string;
    description: string | null;
    modules: CatalogModule[];
}

/** The same item, wherever it appears: the same type and URL, or (without a URL) the same type and title. */
export function itemKey( item: Pick<CatalogItem, 'type' | 'title' | 'details'> ): string {
    const url = item.details.url;

    return typeof url === 'string' ? `${item.type} ${url}` : `${item.type} "${item.title}"`;
}

const pathFile = Compile( PathFile );
const detailValidators = Object.fromEntries(
    Object.values( ItemType ).map( ( type ) => [ type, Compile( ItemDetailsSchemas[type] ) ] ),
) as Record<ItemType, ReturnType<typeof Compile>>;

/**
 * Reads a path file. Throws one error listing every problem found, each with where it is
 * (e.g. `modules[2].topics[0].items[3]`).
 */
export function parseCatalogFile( text: string ): CatalogPath {
    let raw: unknown;

    try {
        raw = parse( text );
    } catch ( error ) {
        throw new Error( `Not valid YAML: ${( error as Error ).message}`, { cause: error } );
    }
    if ( !pathFile.Check( raw ) ) {
        const problems = [ ...pathFile.Errors( raw ) ].map( ( error ) => `${error.instancePath || '/'}: ${error.message}` );

        throw new Error( `The file doesn't match the format:\n  ${problems.join( '\n  ' )}` );
    }

    const spec = raw;
    const problems: string[] = [];
    const unique = ( where: string, slugs: string[] ) => {
        const seen = new Set<string>();

        for ( const slug of slugs ) {
            if ( seen.has( slug ) ) {
                problems.push( `${where}: "${slug}" is used twice` );
            }
            seen.add( slug );
        }
    };

    const modules = spec.modules.map( ( module, m ) => {
        const topics = module.topics.map( ( topic, t ) => {
            const where = `modules[${m}].topics[${t}]`;
            const items = topic.items.map( ( item, i ) => toItem( item, `${where}.items[${i}]`, problems ) );

            unique( `${where} items`, items.map( itemKey ) );

            return {
                slug: topic.slug ?? toSlug( topic.title ),
                title: topic.title,
                description: topic.description ?? null,
                items,
            };
        } );

        unique( `modules[${m}] topic slugs`, topics.map( ( topic ) => topic.slug ) );

        return {
            slug: module.slug ?? toSlug( module.title ),
            title: module.title,
            description: module.description ?? null,
            topics,
        };
    } );

    unique( 'module slugs', modules.map( ( module ) => module.slug ) );
    if ( problems.length > 0 ) {
        throw new Error( `The file has problems:\n  ${problems.join( '\n  ' )}` );
    }

    return { slug: spec.slug, title: spec.title, description: spec.description ?? null, modules };
}

function toItem( spec: ItemSpecValue, where: string, problems: string[] ): CatalogItem {
    const leetcode = spec.leetcode
        ? { url: `https://leetcode.com/problems/${spec.leetcode}/`, platform: 'leetcode' }
        : {};
    const type = spec.leetcode ? ItemType.Problem : spec.type;

    if ( !type ) {
        problems.push( `${where} ("${spec.title}"): needs a type, or leetcode for a LeetCode problem` );

        // A placeholder: the import stops on the problem above.
        return {
            type: ItemType.Note,
            title: spec.title,
            description: null,
            difficulty: null,
            estimatedMinutes: null,
            tags: [],
            details: {},
            isOptional: false,
        };
    }
    if ( spec.leetcode && spec.type && spec.type !== ItemType.Problem ) {
        problems.push( `${where} ("${spec.title}"): leetcode items are problems, not ${spec.type}` );
    }

    const allowed = DETAIL_KEYS[type];
    const details: Record<string, unknown> = { ...leetcode };

    for ( const key of Object.keys( DETAIL_KEYS ).flatMap( ( t ) => DETAIL_KEYS[t as ItemType] ) ) {
        const value = spec[key];

        if ( value === undefined ) {
            continue;
        }
        if ( allowed.includes( key ) ) {
            details[key] = value;
        } else {
            problems.push( `${where} ("${spec.title}"): ${key} isn't used by a ${type}` );
        }
    }

    const validator = detailValidators[type];

    if ( !validator.Check( details ) ) {
        const reasons = [ ...validator.Errors( details ) ].map( ( error ) => `${error.instancePath || 'details'} ${error.message}` );

        problems.push( `${where} ("${spec.title}"): ${reasons.join( '; ' )}` );
    }

    return {
        type,
        title: spec.title,
        description: spec.description ?? null,
        difficulty: spec.difficulty ?? null,
        estimatedMinutes: spec.minutes ?? null,
        tags: spec.tags ?? [],
        details,
        isOptional: spec.optional ?? false,
    };
}
