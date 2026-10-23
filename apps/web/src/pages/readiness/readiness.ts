import type { EnrollmentJson, ReadinessJson } from '@studylog/schemas';

import type { IconName } from '../../components/Icon.tsx';
import { formatStatsDate } from '../../format/format.ts';

export type Readiness = NonNullable<ReadinessJson['readiness']>;
export type Category = Readiness['categories'][number];
export type NextStep = Readiness['nextSteps'][number];
export type Tone = 'success' | 'warning' | 'danger' | 'neutral';

/** The overall label's color: green when ready, amber on the way, red at the start. */
export const LABEL_TONES: Record<Readiness['label'], Tone> = {
    Ready: 'success',
    'Almost ready': 'warning',
    'Getting there': 'warning',
    'Just started': 'danger',
};

/** What each category measures, under its name. */
export const CATEGORIES: Record<Category['key'], { title: string; description: string }> = {
    coverage: { title: 'Coverage', description: 'What you\'ve finished in your goal\'s paths' },
    depth: { title: 'Depth', description: 'Harder problems, not just easy ones' },
    revision: { title: 'Revision', description: 'Coming back to what you marked Revise' },
    consistency: { title: 'Consistency', description: 'Studying regularly until the day' },
};

/** A category score in words and color: Strong (80+), Moderate (50+) or Weak. */
export function strengthOf( score: number ): { label: string; tone: Tone } {
    if ( score >= 80 ) {
        return { label: 'Strong', tone: 'success' };
    }

    return score >= 50 ? { label: 'Moderate', tone: 'warning' } : { label: 'Weak', tone: 'danger' };
}

/** The line under the goal: which paths count, and the strongest and weakest categories. */
export function summaryOf( readiness: Readiness, goalPaths: string[] ): string {
    const based = goalPaths.length > 0 ? `Based on ${listOf( goalPaths )}.` : 'None of the goal\'s paths are on your list any more.';
    const sorted = [ ...readiness.categories ].sort( ( a, b ) => b.score - a.score );
    const strongest = sorted[0];
    const weakest = sorted.at( -1 );

    if ( !strongest || !weakest || strongest.score === weakest.score ) {
        return based;
    }

    return `${based} You're strongest on ${CATEGORIES[strongest.key].title.toLowerCase()}; `
        + `work on ${CATEGORIES[weakest.key].title.toLowerCase()} to be ready in time.`;
}

/** Titles of the goal's paths that the user still follows, in the goal's order. */
export function goalPathTitles( enrollmentIds: string[], paths: EnrollmentJson[] ): string[] {
    return enrollmentIds.flatMap( ( id ) => {
        const path = paths.find( ( candidate ) => candidate.id === id );

        return path ? [ path.learningPath.title ] : [];
    } );
}

/** "A", "A and B", "A, B and C". */
function listOf( names: string[] ): string {
    return names.length <= 1 ? names.join( '' ) : `${names.slice( 0, -1 ).join( ', ' )} and ${names.at( -1 )}`;
}

/** The three facts under the summary: time left, pace and when everything would be done. */
export function factsOf( readiness: Readiness ): { label: string; value: string; icon: IconName; tone?: Tone }[] {
    const { daysLeft, pace } = readiness;
    const paceTone: Tone = pace.onTrack ? 'success' : 'warning';
    const perDay = `${pace.itemsPerDay} ${pace.itemsPerDay === 1 ? 'item' : 'items'} a day`;

    return [
        { label: 'Time left', value: daysLeft === 0 ? 'The day is here' : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`, icon: 'calendar' },
        { label: 'Your pace', value: pace.neededPerDay === null ? perDay : `${perDay} · need ${pace.neededPerDay}`, icon: 'trending-up', tone: paceTone },
        { label: 'At this pace', ...projection( pace ) },
    ];
}

function projection( pace: Readiness['pace'] ): { value: string; icon: IconName; tone: Tone } {
    if ( pace.projectedDate ) {
        return {
            value: `Done by ${formatStatsDate( pace.projectedDate )}`,
            icon: pace.onTrack ? 'check-circle' : 'clock',
            tone: pace.onTrack ? 'success' : 'warning',
        };
    }

    // No date: either everything is done, or nothing was finished lately.
    return pace.onTrack
        ? { value: 'Everything done', icon: 'check-circle', tone: 'success' }
        : { value: 'No recent progress', icon: 'clock', tone: 'warning' };
}

/** How each kind of next step looks, and what its button does. */
export const STEP_KINDS: Record<NextStep['kind'], { icon: IconName; action: string }> = {
    module: { icon: 'layers', action: 'Open' },
    mock: { icon: 'users', action: 'Log time' },
    revise: { icon: 'flag', action: 'Review' },
    resume: { icon: 'book-open', action: 'Resume' },
    hard: { icon: 'zap', action: 'Open' },
};

export const PRIORITIES: Record<NextStep['priority'], { label: string; tone: Tone }> = {
    high: { label: 'High', tone: 'danger' },
    medium: { label: 'Medium', tone: 'warning' },
    low: { label: 'Low', tone: 'neutral' },
};

/** Where a step's button goes: logging time on the item for a mock interview, else its topic in the path. */
export function stepLink( step: NextStep ): string {
    if ( step.kind === 'mock' && step.topicId && step.itemId ) {
        return `/app/sessions?log&path=${step.enrollmentId}&topic=${step.topicId}&item=${step.itemId}`;
    }

    return `/app/paths/${step.enrollmentId}${step.topicId ? `?topic=${step.topicId}` : ''}`;
}

/** The footnote: "coverage 40% · depth 25% · revision 15% · consistency 20%". */
export function weightsOf( weights: Readiness['weights'] ): string {
    return ( Object.keys( CATEGORIES ) as Category['key'][] )
        .map( ( key ) => `${key} ${weights[key]}%` )
        .join( ' · ' );
}
