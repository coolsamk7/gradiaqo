import { addDays, computeStreaks, lastDays, startOfWeek, toLocalDate } from './stats-dates.js';

describe( 'stats dates', () => {
    it( 'uses the calendar date in the given time zone', () => {
        const instant = new Date( '2026-09-24T20:00:00Z' );

        expect( toLocalDate( instant, 'UTC' ) ).toBe( '2026-09-24' );
        expect( toLocalDate( instant, 'Asia/Kolkata' ) ).toBe( '2026-09-25' ); // 01:30 the next day
        expect( toLocalDate( instant, 'America/Los_Angeles' ) ).toBe( '2026-09-24' );
    } );

    it( 'adds days across month, year and daylight saving boundaries', () => {
        expect( addDays( '2026-02-28', 1 ) ).toBe( '2026-03-01' );
        expect( addDays( '2026-12-31', 1 ) ).toBe( '2027-01-01' );
        expect( addDays( '2026-03-08', 1 ) ).toBe( '2026-03-09' );
    } );

    it( 'starts weeks on Monday', () => {
        expect( startOfWeek( '2026-09-25' ) ).toBe( '2026-09-21' ); // Friday → Monday
        expect( startOfWeek( '2026-09-21' ) ).toBe( '2026-09-21' ); // Monday
        expect( startOfWeek( '2026-09-27' ) ).toBe( '2026-09-21' ); // Sunday
    } );

    it( 'lists the last n days, oldest first', () => {
        expect( lastDays( '2026-09-02', 3 ) ).toEqual( [ '2026-08-31', '2026-09-01', '2026-09-02' ] );
    } );

    describe( 'computeStreaks', () => {
        const days = [ '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-10', '2026-09-23', '2026-09-24' ];

        it( 'counts a current streak ending today or yesterday, and the longest ever', () => {
            expect( computeStreaks( [ ...days, '2026-09-25' ], '2026-09-25' ) ).toEqual( { current: 3, longest: 3 } );
            expect( computeStreaks( days, '2026-09-25' ) ).toEqual( { current: 2, longest: 3 } );
        } );

        it( 'has no current streak after a missed day', () => {
            expect( computeStreaks( days, '2026-09-26' ) ).toEqual( { current: 0, longest: 3 } );
            expect( computeStreaks( [], '2026-09-26' ) ).toEqual( { current: 0, longest: 0 } );
        } );
    } );
} );
