import type { EnrollmentDetailJson, EnrollmentRule, PublishedPathJson } from '@studylog/schemas';
import { RuleMode, RuleScope } from '@studylog/schemas/enums';

/*
 * Choosing which parts of a path to follow, by topic. The API speaks in rules (include or exclude a module, topic
 * or item; the most specific wins); the dialog speaks in ticked topics. These turn one into the other.
 */

export type PathModules = PublishedPathJson['modules'];
type PathModule = PathModules[number];

/** Every topic, ticked: following the whole path. */
export function allTopics( modules: PathModules ): Set<string> {
    return new Set( modules.flatMap( ( module ) => module.topics.map( ( topic ) => topic.id ) ) );
}

/** The topics an enrollment follows now: those its view of the path still shows. */
export function followedTopics( modules: PathModules, enrollment: EnrollmentDetailJson ): Set<string> {
    const shown = new Set( enrollment.modules.flatMap( ( module ) => module.topics.map( ( topic ) => topic.id ) ) );

    return new Set( [ ...allTopics( modules ) ].filter( ( id ) => shown.has( id ) ) );
}

/** Whether a module's topics are all ticked, some, or none (an empty module counts as none). */
export function moduleState( module: PathModule, ticked: Set<string> ): 'all' | 'some' | 'none' {
    const count = module.topics.filter( ( topic ) => ticked.has( topic.id ) ).length;

    if ( count === 0 ) {
        return 'none';
    }

    return count === module.topics.length ? 'all' : 'some';
}

/** Ticks or unticks all of a module's topics. */
export function toggleModule( module: PathModule, ticked: Set<string> ): Set<string> {
    const next = new Set( ticked );
    const select = moduleState( module, ticked ) !== 'all';

    for ( const topic of module.topics ) {
        if ( select ) {
            next.add( topic.id );
        } else {
            next.delete( topic.id );
        }
    }

    return next;
}

export function toggleTopic( topicId: string, ticked: Set<string> ): Set<string> {
    const next = new Set( ticked );

    if ( !next.delete( topicId ) ) {
        next.add( topicId );
    }

    return next;
}

/** Distinct items in the ticked topics (an item can sit in several topics). */
export function countItems( modules: PathModules, ticked: Set<string> ): number {
    return new Set( modules.flatMap( ( module ) => module.topics
        .filter( ( topic ) => ticked.has( topic.id ) )
        .flatMap( ( topic ) => topic.items.map( ( item ) => item.id ) ) ) ).size;
}

/**
 * The rules for the ticked topics. Everything ticked: no include rules, so the whole path follows, including
 * modules added later. A whole module ticked: the module, so topics added to it later follow too. Otherwise the
 * ticked topics. `keep` are rules to carry over, e.g. items the user chose to skip; item includes are dropped,
 * since they would narrow the path down to those items.
 */
export function rulesFor( modules: PathModules, ticked: Set<string>, keep: EnrollmentRule[] = [] ): EnrollmentRule[] {
    const skipped = keep.filter( ( rule ) => rule.scope === RuleScope.Item && rule.mode === RuleMode.Exclude );
    const everything = modules.every( ( module ) => moduleState( module, ticked ) === 'all' || module.topics.length === 0 );

    if ( everything ) {
        return skipped;
    }

    const include = ( scope: RuleScope, scopeId: string ): EnrollmentRule =>
        ( { scope, scopeId, mode: RuleMode.Include } );
    const chosen = modules.flatMap( ( module ) => {
        const state = moduleState( module, ticked );

        if ( state === 'all' ) {
            return [ include( RuleScope.Module, module.id ) ];
        }

        return module.topics
            .filter( ( topic ) => ticked.has( topic.id ) )
            .map( ( topic ) => include( RuleScope.Topic, topic.id ) );
    } );

    return [ ...chosen, ...skipped ];
}

/** What the user follows, in a line: "The whole path", or "3 of 4 modules · 19 of 25 items. Dynamic Programming is left out." */
export function describeParts( modules: PathModules, ticked: Set<string> ): string {
    const withTopics = modules.filter( ( module ) => module.topics.length > 0 );
    const left = withTopics.filter( ( module ) => moduleState( module, ticked ) === 'none' );

    if ( left.length === 0 && withTopics.every( ( module ) => moduleState( module, ticked ) === 'all' ) ) {
        return 'The whole path, including anything the author adds later.';
    }

    const followed = withTopics.length - left.length;
    const counts = `${followed} of ${withTopics.length} modules · ${countItems( modules, ticked )} of ${countItems( modules, allTopics( modules ) )} items.`;

    if ( left.length === 0 ) {
        return `${counts} Some topics are left out.`;
    }

    const names = left.length <= 2
        ? left.map( ( module ) => module.title ).join( ' and ' )
        : `${left[0]?.title}, ${left[1]?.title} and ${left.length - 2} more`;

    return `${counts} ${names} ${left.length === 1 ? 'is' : 'are'} left out.`;
}
