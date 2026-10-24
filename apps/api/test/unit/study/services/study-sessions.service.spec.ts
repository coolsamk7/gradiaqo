import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StudySession, TopicItem } from '@studylog/database';
import type { DataSource } from 'typeorm';
import { And, LessThan, MoreThanOrEqual } from 'typeorm';

import type { CatalogAccessService } from '../../../../src/catalog/services/catalog-access.service.js';
import { StudySessionsService } from '../../../../src/study/services/study-sessions.service.js';
import type { FakeDataSource } from '../../fake-data-source.js';
import { fakeDataSource } from '../../fake-data-source.js';

const NOW = new Date( '2026-09-25T10:00:00Z' );

describe( 'StudySessionsService', () => {
    let db: FakeDataSource;
    let access: { canSeeTopic: ReturnType<typeof vi.fn>; canSeeItem: ReturnType<typeof vi.fn> };
    let service: StudySessionsService;

    beforeEach( () => {
        vi.useFakeTimers( { now: NOW } );
        db = fakeDataSource();
        db.repo( TopicItem ).existsBy.mockResolvedValue( true );
        access = { canSeeTopic: vi.fn().mockResolvedValue( true ), canSeeItem: vi.fn().mockResolvedValue( true ) };
        service = new StudySessionsService( db as unknown as DataSource, access as unknown as CatalogAccessService );
    } );

    afterEach( () => {
        vi.useRealTimers();
    } );

    const session = { topicId: 'topic', itemId: 'item', startedAt: new Date( NOW.getTime() - 3_600_000 ), durationMinutes: 25 };

    describe( 'create', () => {
        it( 'saves a session for the user', async () => {
            await service.create( 'me', session );

            expect( db.repo( StudySession ).save ).toHaveBeenCalledWith( expect.objectContaining( { ...session, userId: 'me', notes: null } ) );
        } );

        it( 'needs a topic or an item', async () => {
            await expect( service.create( 'me', { startedAt: NOW, durationMinutes: 5 } ) ).rejects.toThrow( BadRequestException );
        } );

        it( 'allows 5 minutes of clock skew, but no later start', async () => {
            await service.create( 'me', { ...session, startedAt: new Date( NOW.getTime() + 4 * 60_000 ) } );

            await expect( service.create( 'me', { ...session, startedAt: new Date( NOW.getTime() + 6 * 60_000 ) } ) )
                .rejects.toThrow( 'startedAt can\'t be in the future' );
        } );

        it( 'needs a topic and item the user can see, with the item in the topic', async () => {
            access.canSeeTopic.mockResolvedValueOnce( false );
            await expect( service.create( 'me', session ) ).rejects.toThrow( new NotFoundException( 'Topic not found' ) );

            access.canSeeItem.mockResolvedValueOnce( false );
            await expect( service.create( 'me', session ) ).rejects.toThrow( new NotFoundException( 'Item not found' ) );

            db.repo( TopicItem ).existsBy.mockResolvedValue( false );
            await expect( service.create( 'me', session ) ).rejects.toThrow( 'This item is not in this topic' );
        } );
    } );

    describe( 'update', () => {
        beforeEach( () => {
            db.repo( StudySession ).findOneBy.mockResolvedValue( { id: 's', userId: 'me', ...session } );
        } );

        it( 'is "not found" for someone else\'s session', async () => {
            db.repo( StudySession ).findOneBy.mockResolvedValue( null );

            await expect( service.update( 'me', 's', { durationMinutes: 40 } ) ).rejects.toThrow( NotFoundException );
            expect( db.repo( StudySession ).findOneBy ).toHaveBeenCalledWith( { id: 's', userId: 'me' } );
        } );

        it( 'doesn\'t re-check an unchanged topic or item (they may have been archived since)', async () => {
            access.canSeeTopic.mockResolvedValue( false );
            access.canSeeItem.mockResolvedValue( false );

            await service.update( 'me', 's', { durationMinutes: 40, notes: 'longer' } );

            expect( access.canSeeTopic ).not.toHaveBeenCalled();
            expect( db.repo( StudySession ).save )
                .toHaveBeenCalledWith( expect.objectContaining( { durationMinutes: 40 } ) );
        } );

        it( 'checks a changed item', async () => {
            access.canSeeItem.mockResolvedValue( false );

            await expect( service.update( 'me', 's', { itemId: 'other' } ) ).rejects.toThrow( NotFoundException );
        } );
    } );

    it( 'remove only deletes the user\'s own session', async () => {
        db.repo( StudySession ).delete.mockResolvedValue( { affected: 0 } );

        await expect( service.remove( 'me', 's' ) ).rejects.toThrow( NotFoundException );
        expect( db.repo( StudySession ).delete ).toHaveBeenCalledWith( { id: 's', userId: 'me' } );
    } );

    describe( 'list', () => {
        const where = () =>
            ( db.repo( StudySession ).findAndCount.mock.lastCall?.[0] as { where: Record<string, unknown> } ).where;
        const FROM = new Date( '2026-09-01T00:00:00Z' );
        const TO = new Date( '2026-09-08T00:00:00Z' );

        it( 'pages through the user\'s sessions, newest first, with what each was about', async () => {
            await service.list( 'me', {} );

            expect( db.repo( StudySession ).findAndCount ).toHaveBeenCalledWith( {
                where: { userId: 'me' },
                relations: { topic: true, item: true },
                order: { startedAt: 'DESC', id: 'ASC' },
                take: 50,
                skip: 0,
            } );
        } );

        it( 'filters by topic, item and a [from, to) range on startedAt', async () => {
            await service.list( 'me', { from: FROM, to: TO, topicId: 't', itemId: 'i' } );
            expect( where() ).toEqual( { userId: 'me', startedAt: And( MoreThanOrEqual( FROM ), LessThan( TO ) ), topicId: 't', itemId: 'i' } );

            await service.list( 'me', { from: FROM } );
            expect( where().startedAt ).toEqual( MoreThanOrEqual( FROM ) );

            await service.list( 'me', { to: TO } );
            expect( where().startedAt ).toEqual( LessThan( TO ) );
        } );
    } );

    it( 'remove deletes the user\'s own session', async () => {
        await service.remove( 'me', 's' );

        expect( db.repo( StudySession ).delete ).toHaveBeenCalledWith( { id: 's', userId: 'me' } );
    } );
} );
