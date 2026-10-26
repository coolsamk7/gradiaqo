import { overviewTiles, signupSummary } from './overview.ts';

describe( 'overview', () => {
    it( 'counts in words', () => {
        const tiles = overviewTiles( {
            users: { total: 2, verified: 2, superadmins: 2 },
            activeUsers: { last7Days: 0, last30Days: 1 },
            signups: { last30Days: 1, perDay: [] },
            study: { learners: 1, sessions: 2, minutes: 45 },
            topPaths: [],
        } );

        expect( tiles.map( ( tile ) => `${tile.label}: ${tile.value} (${tile.detail}) ${tile.icon}` ) ).toEqual( [
            'Users: 2 (2 verified · 2 superadmins) users',
            'Active this week: 0 (1 in 30 days) zap',
            'New sign-ups: 1 (In the last 30 days) user',
            'Studying: 1 (2 sessions · 45m) clock',
        ] );
    } );

    it( 'sums up sign-ups, naming the first of the busiest days', () => {
        expect( signupSummary( [ { date: '2026-10-01', count: 0 } ] ) ).toBe( 'No sign-ups in the last 30 days.' );
        expect( signupSummary( [ { date: '2026-10-01', count: 1 } ] ) ).toBe( '1 sign-up, the most on Oct 1 (1).' );
        expect( signupSummary( [
            { date: '2026-10-01', count: 2 },
            { date: '2026-10-02', count: 3 },
            { date: '2026-10-03', count: 3 },
        ] ) ).toBe( '8 sign-ups, the most on Oct 2 (3).' );
    } );
} );
