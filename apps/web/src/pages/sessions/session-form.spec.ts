import { ApiError, NetworkError } from '../../api/client.ts';
import type { SessionFormValues } from './session-form.ts';
import {
    describeSaveError,
    editSessionValues,
    newSessionValues,
    toCreateRequest,
    toUpdateRequest,
    validate,
} from './session-form.ts';

// Tests run in UTC (see vitest.config.ts).
const NOW = new Date( '2026-09-29T09:00:00Z' );

const VALID: SessionFormValues = {
    path: 'enrollment-1',
    topic: 'topic-1',
    item: '',
    date: '2026-09-29',
    time: '08:15',
    duration: '45',
    notes: '',
};

describe( 'form values', () => {
    it( 'start as a 30-minute session that just ended', () => {
        expect( newSessionValues( NOW ) ).toEqual( {
            path: '', topic: '', item: '', date: '2026-09-29', time: '08:30', duration: '30', notes: '',
        } );
    } );

    it( 'go back to yesterday when that session started before midnight', () => {
        expect( newSessionValues( new Date( '2026-09-29T00:10:00Z' ) ) ).toMatchObject( { date: '2026-09-28', time: '23:40' } );
    } );

    it( 'show an existing session\'s time, duration and notes', () => {
        expect( editSessionValues( { startedAt: '2026-09-27T18:05:00.000Z', durationMinutes: 90, notes: 'Tricky' } ) )
            .toEqual( { path: '', topic: '', item: '', date: '2026-09-27', time: '18:05', duration: '90', notes: 'Tricky' } );
        expect( editSessionValues( { startedAt: '2026-09-27T18:05:00.000Z', durationMinutes: 90, notes: null } ).notes ).toBe( '' );
    } );
} );

describe( 'validate', () => {
    const check = ( changes: Partial<SessionFormValues>, choosesTopic = true ) =>
        validate( { ...VALID, ...changes }, NOW, { choosesTopic } );

    it( 'accepts a complete session', () => {
        expect( check( {} ) ).toEqual( {} );
        expect( check( { time: '09:00', duration: '1', notes: 'x'.repeat( 10_000 ) } ) ).toEqual( {} );
        expect( check( { duration: '1440' } ) ).toEqual( {} );
    } );

    it( 'asks for a path, then a topic, when logging', () => {
        expect( check( { path: '', topic: '' } ) ).toEqual( { path: 'Choose a learning path.' } );
        expect( check( { topic: '' } ) ).toEqual( { topic: 'Choose a topic.' } );
        expect( check( { path: '', topic: '' }, false ) ).toEqual( {} );
    } );

    it( 'needs a date and a start that isn\'t in the future', () => {
        expect( check( { date: '' } ) ).toEqual( { date: 'Enter the date you studied.' } );
        expect( check( { date: '', time: '' } ) ).toEqual( { date: 'Enter the date you studied.' } );
        expect( check( { time: '' } ) ).toEqual( { time: 'Enter the time you started.' } );
        expect( check( { time: '09:01' } ) ).toEqual( { time: 'The start can\'t be in the future.' } );
        expect( check( { date: '2026-09-30', time: '00:00' } ) ).toEqual( { time: 'The start can\'t be in the future.' } );
    } );

    it( 'needs whole minutes from 1 to 1440', () => {
        const error = { duration: 'Enter the minutes you studied, from 1 to 1440.' };

        for ( const duration of [ '', ' ', '0', '1441', '1.5', '-5', '30m', 'abc' ] ) {
            expect( check( { duration } ), duration ).toEqual( error );
        }
        expect( check( { duration: ' 45 ' } ) ).toEqual( {} );
    } );

    it( 'limits notes to 10,000 characters', () => {
        expect( check( { notes: 'x'.repeat( 10_001 ) } ) ).toEqual( { notes: 'Notes can be at most 10,000 characters.' } );
    } );
} );

describe( 'requests', () => {
    it( 'log the topic, the item if one was chosen, and the time', () => {
        expect( toCreateRequest( { ...VALID, item: 'item-1', notes: '  Finally clicked!  ' } ) ).toEqual( {
            topicId: 'topic-1',
            itemId: 'item-1',
            startedAt: '2026-09-29T08:15:00.000Z',
            durationMinutes: 45,
            notes: 'Finally clicked!',
        } );
    } );

    it( 'leave the item out for the whole topic, and send blank notes as none', () => {
        expect( toCreateRequest( { ...VALID, notes: '   ' } ) ).toEqual( {
            topicId: 'topic-1', startedAt: '2026-09-29T08:15:00.000Z', durationMinutes: 45, notes: null,
        } );
    } );

    it( 'only change the time, duration and notes when editing', () => {
        expect( toUpdateRequest( { ...VALID, item: 'item-1', duration: ' 90 ', notes: 'x' } ) ).toEqual( {
            startedAt: '2026-09-29T08:15:00.000Z', durationMinutes: 90, notes: 'x',
        } );
    } );
} );

describe( 'describeSaveError', () => {
    const validation = new ApiError( 400, 'Bad Request', {
        fieldErrors: { durationMinutes: 'must be at most 1440', startedAt: 'must be a date-time', topicId: 'must be a uuid' },
    } );

    it( 'shows the API\'s validation errors on the matching inputs', () => {
        expect( describeSaveError( validation, { editing: false } ) ).toEqual( {
            form: undefined,
            fields: {
                topic: 'Topic must be a uuid.',
                time: 'Start must be a date-time.',
                duration: 'Duration must be at most 1440.',
            },
        } );
        expect( describeSaveError( new ApiError( 400, 'x', { fieldErrors: { itemId: 'must be a uuid', notes: 'too long' } } ), { editing: false } ) )
            .toEqual( { form: undefined, fields: { item: 'Item must be a uuid.', notes: 'Notes too long.' } } );
    } );

    it( 'explains a 404 by what is gone', () => {
        const missing = new ApiError( 404, 'Not Found' );

        expect( describeSaveError( missing, { editing: false } ).form ).toBe( 'That topic or item is no longer available. Choose another one.' );
        expect( describeSaveError( missing, { editing: true } ).form ).toBe( 'This session no longer exists. It may have been deleted elsewhere.' );
    } );

    it( 'handles problems every form can hit', () => {
        expect( describeSaveError( new NetworkError(), { editing: false } ) )
            .toEqual( { form: 'Can\'t reach Gradiaqo right now. Check your connection and try again.', fields: {} } );
        expect( describeSaveError( new ApiError( 400, 'startedAt can\'t be in the future' ), { editing: false } ).form )
            .toBe( 'Check your details and try again.' );
    } );
} );
