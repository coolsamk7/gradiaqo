import type {
    CreateStudySessionRequestJson,
    StudySessionJson,
    UpdateStudySessionRequestJson,
} from '@studylog/schemas';

import { fromDateTimeInputs, toDateInput, toTimeInput } from '../../format/format.ts';
import type { FieldErrors, FormErrors } from '../../forms/form-errors.ts';
import { describeApiError } from '../../forms/form-errors.ts';

/** Same limits as CreateStudySessionRequest. */
export const MAX_DURATION_MINUTES = 24 * 60;
export const MAX_NOTES_LENGTH = 10_000;

/** A new session starts this long before now, so the form reads as "a session that just ended". */
const DEFAULT_DURATION_MINUTES = 30;

/** The form's inputs, in page order (the first one with an error gets focus). */
export const FIELDS = [ 'path', 'topic', 'item', 'date', 'time', 'duration', 'notes' ] as const;
export type Field = ( typeof FIELDS )[number];

export type SessionFormValues = Record<Field, string>;

export function newSessionValues( now: Date ): SessionFormValues {
    const start = new Date( now.getTime() - DEFAULT_DURATION_MINUTES * 60_000 );

    return {
        path: '',
        topic: '',
        item: '',
        date: toDateInput( start ),
        time: toTimeInput( start ),
        duration: String( DEFAULT_DURATION_MINUTES ),
        notes: '',
    };
}

/** An existing session's values. What it's about isn't edited here, so path, topic and item stay empty. */
export function editSessionValues( session: Pick<StudySessionJson, 'startedAt' | 'durationMinutes' | 'notes'> ): SessionFormValues {
    const start = new Date( session.startedAt );

    return {
        path: '',
        topic: '',
        item: '',
        date: toDateInput( start ),
        time: toTimeInput( start ),
        duration: String( session.durationMinutes ),
        notes: session.notes ?? '',
    };
}

/** Problems visible without asking the API. `choosesTopic`: the form asks what was studied (only when logging). */
export function validate(
    values: SessionFormValues,
    now: Date,
    { choosesTopic }: { choosesTopic: boolean },
): FieldErrors<Field> {
    const errors: FieldErrors<Field> = {};
    const start = fromDateTimeInputs( values.date, values.time );
    const duration = Number( values.duration );

    if ( choosesTopic && !values.path ) {
        errors.path = 'Choose a learning path.';
    } else if ( choosesTopic && !values.topic ) {
        errors.topic = 'Choose a topic.';
    }
    if ( !fromDateTimeInputs( values.date, '00:00' ) ) {
        errors.date = 'Enter the date you studied.';
    } else if ( !start ) {
        errors.time = 'Enter the time you started.';
    } else if ( start > now ) {
        errors.time = 'The start can\'t be in the future.';
    }
    if ( !/^\d+$/.test( values.duration.trim() ) || duration < 1 || duration > MAX_DURATION_MINUTES ) {
        errors.duration = `Enter the minutes you studied, from 1 to ${MAX_DURATION_MINUTES}.`;
    }
    if ( values.notes.length > MAX_NOTES_LENGTH ) {
        errors.notes = `Notes can be at most ${MAX_NOTES_LENGTH.toLocaleString( 'en-US' )} characters.`;
    }

    return errors;
}

/** The time fields as the API wants them. Call after validate() found no errors. */
function timing( values: SessionFormValues ) {
    const notes = values.notes.trim();

    return {
        startedAt: ( fromDateTimeInputs( values.date, values.time )! ).toISOString(),
        durationMinutes: Number( values.duration ),
        notes: notes === '' ? null : notes,
    };
}

export function toCreateRequest( values: SessionFormValues ): CreateStudySessionRequestJson {
    return {
        topicId: values.topic,
        // "Whole topic" leaves the item out.
        ...( values.item && { itemId: values.item } ),
        ...timing( values ),
    };
}

export function toUpdateRequest( values: SessionFormValues ): UpdateStudySessionRequestJson {
    return timing( values );
}

/** The API's field names, and the input that shows each one's errors. */
const API_FIELDS = {
    topicId: [ 'topic', 'Topic' ],
    itemId: [ 'item', 'Item' ],
    startedAt: [ 'time', 'Start' ],
    durationMinutes: [ 'duration', 'Duration' ],
    notes: [ 'notes', 'Notes' ],
} as const satisfies Record<string, readonly [ Field, string ]>;

type ApiField = keyof typeof API_FIELDS;

/** Explains a failed save on the form. A 404 means the session (editing) or what it's about (logging) is gone. */
export function describeSaveError( error: unknown, { editing }: { editing: boolean } ): FormErrors<Field> {
    const labels = Object.fromEntries( Object.entries( API_FIELDS ).map( ( [ name, entry ] ) => [ name, entry[1] ] ) );
    const { form, fields } = describeApiError( error, labels as Record<ApiField, string>, {
        404: {
            form: editing
                ? 'This session no longer exists. It may have been deleted elsewhere.'
                : 'That topic or item is no longer available. Choose another one.',
        },
    } );

    return {
        form,
        fields: Object.fromEntries( ( Object.entries( fields ) as [ ApiField, string ][] )
            .map( ( [ name, message ] ) => [ API_FIELDS[name][0], message ] ) ),
    };
}
