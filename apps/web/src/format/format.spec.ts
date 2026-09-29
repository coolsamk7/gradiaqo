import {
    describeSession,
    formatDays,
    formatMinutes,
    formatSessionStart,
    formatStatsDate,
    formatTime,
    fromDateTimeInputs,
    greeting,
    percent,
    relativeDay,
    toDateInput,
    toTimeInput,
} from './format.ts';

// Tests run in UTC (see vitest.config.ts), so local times below are UTC times.

describe( 'formatMinutes', () => {
    it( 'shows minutes, hours, or both', () => {
        expect( formatMinutes( 0 ) ).toBe( '0m' );
        expect( formatMinutes( 45 ) ).toBe( '45m' );
        expect( formatMinutes( 59 ) ).toBe( '59m' );
        expect( formatMinutes( 60 ) ).toBe( '1h' );
        expect( formatMinutes( 95 ) ).toBe( '1h 35m' );
        expect( formatMinutes( 1660 ) ).toBe( '27h 40m' );
    } );
} );

describe( 'formatDays', () => {
    it( 'uses the singular for one day', () => {
        expect( formatDays( 0 ) ).toBe( '0 days' );
        expect( formatDays( 1 ) ).toBe( '1 day' );
        expect( formatDays( 12 ) ).toBe( '12 days' );
    } );
} );

describe( 'percent', () => {
    it( 'rounds to a whole percentage, and is 0 when there is nothing to do', () => {
        expect( percent( 1, 3 ) ).toBe( 33 );
        expect( percent( 2, 3 ) ).toBe( 67 );
        expect( percent( 19, 19 ) ).toBe( 100 );
        expect( percent( 0, 0 ) ).toBe( 0 );
    } );
} );

describe( 'formatSessionStart', () => {
    const now = new Date( '2026-09-29T08:00:00Z' );

    it( 'says today and yesterday by calendar day, not by 24 hours', () => {
        expect( formatSessionStart( new Date( '2026-09-29T00:15:00Z' ), now ) ).toBe( 'Today, 12:15 AM' );
        expect( formatSessionStart( new Date( '2026-09-28T23:45:00Z' ), now ) ).toBe( 'Yesterday, 11:45 PM' );
        expect( formatSessionStart( new Date( '2026-09-28T00:00:00Z' ), now ) ).toBe( 'Yesterday, 12:00 AM' );
    } );

    it( 'shows the weekday and date for older sessions', () => {
        expect( formatSessionStart( new Date( '2026-09-27T18:30:00Z' ), now ) ).toBe( 'Sun, Sep 27, 6:30 PM' );
        expect( formatSessionStart( new Date( '2026-08-31T09:05:00Z' ), now ) ).toBe( 'Mon, Aug 31, 9:05 AM' );
    } );
} );

describe( 'formatStatsDate', () => {
    it( 'shows a calendar date as it is, whatever the time zone', () => {
        expect( formatStatsDate( '2026-09-01' ) ).toBe( 'Sep 1' );
        expect( formatStatsDate( '2026-12-31' ) ).toBe( 'Dec 31' );
    } );
} );

describe( 'greeting', () => {
    it( 'depends on the local time of day', () => {
        expect( greeting( new Date( '2026-09-29T00:00:00Z' ) ) ).toBe( 'Good morning' );
        expect( greeting( new Date( '2026-09-29T11:59:00Z' ) ) ).toBe( 'Good morning' );
        expect( greeting( new Date( '2026-09-29T12:00:00Z' ) ) ).toBe( 'Good afternoon' );
        expect( greeting( new Date( '2026-09-29T17:59:00Z' ) ) ).toBe( 'Good afternoon' );
        expect( greeting( new Date( '2026-09-29T18:00:00Z' ) ) ).toBe( 'Good evening' );
    } );
} );

describe( 'relativeDay and formatTime', () => {
    const now = new Date( '2026-09-29T08:00:00Z' );

    it( 'name the day and the time separately', () => {
        expect( relativeDay( new Date( '2026-09-29T23:59:00Z' ), now ) ).toBe( 'Today' );
        expect( relativeDay( new Date( '2026-09-28T00:00:00Z' ), now ) ).toBe( 'Yesterday' );
        expect( relativeDay( new Date( '2026-09-22T12:00:00Z' ), now ) ).toBe( 'Tue, Sep 22' );
        expect( formatTime( new Date( '2026-09-22T12:00:00Z' ) ) ).toBe( '12:00 PM' );
    } );
} );

describe( 'describeSession', () => {
    const topic = { title: 'Hashing Basics' };
    const item = { title: 'Two Sum' };

    it( 'names the item, with its topic as context', () => {
        expect( describeSession( { topic, item } ) ).toEqual( { title: 'Two Sum', context: 'Hashing Basics' } );
        expect( describeSession( { topic: null, item } ) ).toEqual( { title: 'Two Sum', context: undefined } );
    } );

    it( 'falls back to the topic, then to a generic title', () => {
        expect( describeSession( { topic, item: null } ) ).toEqual( { title: 'Hashing Basics', context: undefined } );
        expect( describeSession( { topic: null, item: null } ) ).toEqual( { title: 'Study session', context: undefined } );
    } );
} );

describe( 'date and time inputs', () => {
    it( 'give the local date and time, zero-padded', () => {
        const date = new Date( '2026-01-05T07:03:00Z' );

        expect( toDateInput( date ) ).toBe( '2026-01-05' );
        expect( toTimeInput( date ) ).toBe( '07:03' );
    } );

    it( 'read back a local date and time', () => {
        expect( fromDateTimeInputs( '2026-01-05', '07:03' ) ).toEqual( new Date( '2026-01-05T07:03:00Z' ) );
    } );

    it( 'reject missing or malformed values', () => {
        expect( fromDateTimeInputs( '', '07:03' ) ).toBeUndefined();
        expect( fromDateTimeInputs( '2026-01-05', '' ) ).toBeUndefined();
        expect( fromDateTimeInputs( '2026-1-5', '07:03' ) ).toBeUndefined();
        expect( fromDateTimeInputs( '2026-01-05', '7:03' ) ).toBeUndefined();
        expect( fromDateTimeInputs( 'x2026-01-05', '07:03' ) ).toBeUndefined();
        expect( fromDateTimeInputs( '2026-01-05', '07:03x' ) ).toBeUndefined();
        expect( fromDateTimeInputs( '2026-13-45', '07:03' ) ).toBeUndefined();
        expect( fromDateTimeInputs( '2026-01-05', '25:99' ) ).toBeUndefined();
    } );
} );
