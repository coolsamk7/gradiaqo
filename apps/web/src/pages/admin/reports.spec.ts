import { daysAgo } from './reports.ts';

describe( 'report helpers', () => {
    it( 'say how long ago something happened', () => {
        const now = new Date( '2026-10-23T12:00:00Z' );

        expect( daysAgo( '2026-10-23T08:00:00Z', now ) ).toBe( 'today' );
        expect( daysAgo( '2026-10-22T08:00:00Z', now ) ).toBe( 'yesterday' );
        expect( daysAgo( '2026-10-20T12:00:00Z', now ) ).toBe( '3 days ago' );
    } );
} );
