import { BadRequestException } from '@nestjs/common';
import { ItemProgress } from '@studylog/database';
import type { DataSource } from 'typeorm';

import { StatsService } from '../../../src/study/stats.service.js';
import type { FakeDataSource } from '../fake-data-source.js';
import { fakeDataSource } from '../fake-data-source.js';

describe( 'StatsService', () => {
    let db: FakeDataSource;
    let service: StatsService;

    beforeEach( () => {
        // Friday 2026-09-25, 20:00 UTC = Saturday 01:30 in Kolkata.
        vi.useFakeTimers( { now: new Date( '2026-09-25T20:00:00Z' ) } );
        db = fakeDataSource();
        db.repo( ItemProgress ).countBy.mockResolvedValue( 4 );
        service = new StatsService( db as unknown as DataSource );
    } );

    afterEach( () => {
        vi.useRealTimers();
    } );

    it( 'rejects an unknown time zone before querying', async () => {
        await expect( service.get( 'me', 'Mars/Base' ) ).rejects.toThrow( BadRequestException );
        expect( db.query ).not.toHaveBeenCalled();
    } );

    it( 'sums today, this week (from Monday) and all time, with streaks and the last 30 days', async () => {
        db.query.mockResolvedValue( [
            { day: '2026-09-01', minutes: 60 },
            { day: '2026-09-20', minutes: 10 }, // Sunday: last week
            { day: '2026-09-22', minutes: 30 },
            { day: '2026-09-23', minutes: 20 },
            { day: '2026-09-24', minutes: 15 },
            { day: '2026-09-25', minutes: 25 },
        ] );

        const stats = await service.get( 'me' );

        expect( stats ).toMatchObject( {
            timeZone: 'UTC',
            todayMinutes: 25,
            weekMinutes: 90,
            totalMinutes: 160,
            currentStreakDays: 4,
            longestStreakDays: 4,
            itemsCompleted: 4,
        } );
        expect( stats.last30Days ).toHaveLength( 30 );
        expect( stats.last30Days.at( -1 ) ).toEqual( { date: '2026-09-25', minutes: 25 } );
        expect( stats.last30Days[0] ).toEqual( { date: '2026-08-27', minutes: 0 } );
        expect( db.query ).toHaveBeenCalledWith( expect.stringContaining( 'AT TIME ZONE $2' ), [ 'me', 'UTC' ] );
    } );

    it( 'counts days in the user\'s time zone', async () => {
        db.query.mockResolvedValue( [ { day: '2026-09-26', minutes: 30 } ] );

        const stats = await service.get( 'me', 'Asia/Kolkata' );

        expect( stats ).toMatchObject( { todayMinutes: 30, currentStreakDays: 1 } );
        expect( db.query ).toHaveBeenCalledWith( expect.any( String ), [ 'me', 'Asia/Kolkata' ] );
    } );

    it( 'shows zero for today before any study, and no streak without study days', async () => {
        const stats = await service.get( 'me' );

        expect( stats ).toMatchObject( {
            todayMinutes: 0, weekMinutes: 0, totalMinutes: 0, currentStreakDays: 0, longestStreakDays: 0,
        } );
    } );
} );
