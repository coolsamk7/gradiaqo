/** What's missing or wrong in the goal dialog, by field. */
export interface GoalErrors {
    title?: string;
    date?: string;
    paths?: string;
}

/** Checks the goal before saving; empty when it can be saved. Dates compare as "YYYY-MM-DD" text. */
export function validateGoal( title: string, date: string, chosen: number, today: string ): GoalErrors {
    const errors: GoalErrors = {};

    if ( !title.trim() ) {
        errors.title = 'Enter what you\'re preparing for.';
    }
    if ( !date ) {
        errors.date = 'Choose a date.';
    } else if ( date < today ) {
        errors.date = 'Choose today or a later date.';
    }
    if ( chosen === 0 ) {
        errors.paths = 'Choose at least one path.';
    }

    return errors;
}

/** The id of the first field with an error, to move focus to; undefined when there is none. */
export function firstInvalid( errors: GoalErrors ): string | undefined {
    if ( errors.title ) {
        return 'goal-title';
    }
    if ( errors.date ) {
        return 'goal-date';
    }

    return errors.paths ? 'goal-paths' : undefined;
}
