import { createHash } from 'node:crypto';

import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Session } from '@studylog/database';
import type { Repository } from 'typeorm';
import { Not } from 'typeorm';

import { SessionsService } from '../../../src/auth/sessions.service.js';
import type { FakeRepository } from '../fake-data-source.js';
import { fakeRepository } from '../fake-data-source.js';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const hash = ( secret: string ) => createHash( 'sha256' ).update( secret ).digest( 'hex' );
const config = { getOrThrow: () => 180 } as unknown as ConfigService;

describe( 'SessionsService', () => {
    let sessions: FakeRepository;
    let service: SessionsService;

    beforeEach( () => {
        vi.useFakeTimers( { now: new Date( '2026-09-25T10:00:00Z' ) } );
        sessions = fakeRepository();
        service = new SessionsService( sessions as unknown as Repository<Session>, config );
    } );

    afterEach( () => {
        vi.useRealTimers();
    } );

    const stored = ( overrides: Partial<Session> = {} ): Partial<Session> => ( {
        id: SESSION_ID,
        userId: 'user-1',
        tokenHash: hash( 'current' ),
        previousTokenHash: null,
        rotatedAt: null,
        expiresAt: new Date( '2027-01-01T00:00:00Z' ),
        ...overrides,
    } );

    describe( 'create', () => {
        it( 'returns "<sessionId>.<secret>" and stores only a hash of the secret, expiring after the TTL', async () => {
            const token = await service.create( 'user-1', { userAgent: 'x'.repeat( 600 ), ip: '1.2.3.4' } );
            const [ sessionId, secret ] = token.split( '.' );
            const row = sessions.insert.mock.calls[0][0] as Session;

            expect( row.id ).toBe( sessionId );
            expect( row.tokenHash ).toBe( hash( secret ) );
            expect( JSON.stringify( row ) ).not.toContain( secret );
            expect( row.expiresAt ).toEqual( new Date( '2027-03-24T10:00:00Z' ) ); // + 180 days
            expect( row.userAgent ).toHaveLength( 512 );
        } );
    } );

    describe( 'rotate', () => {
        it( 'swaps a valid token for a new one, compare-and-swap on the old hash', async () => {
            sessions.findOneBy.mockResolvedValue( stored() );

            const result = await service.rotate( `${SESSION_ID}.current`, {} );

            expect( result.userId ).toBe( 'user-1' );
            expect( result.token ).toMatch( new RegExp( `^${SESSION_ID}\\.` ) );
            expect( sessions.update ).toHaveBeenCalledWith(
                { id: SESSION_ID, tokenHash: hash( 'current' ) },
                expect.objectContaining( { previousTokenHash: hash( 'current' ), rotatedAt: new Date() } ),
            );
        } );

        it.each( [
            [ 'malformed', 'not-a-token' ],
            [ 'no secret', `${SESSION_ID}.` ],
            [ 'non-uuid session id', 'abc.secret' ],
        ] )( 'rejects a %s token without touching the database', async ( _, token ) => {
            await expect( service.rotate( token, {} ) ).rejects.toThrow( UnauthorizedException );
            expect( sessions.findOneBy ).not.toHaveBeenCalled();
        } );

        it( 'rejects an unknown session', async () => {
            await expect( service.rotate( `${SESSION_ID}.current`, {} ) ).rejects.toThrow( UnauthorizedException );
        } );

        it( 'treats reuse of an already rotated token as theft and ends the session', async () => {
            sessions.findOneBy.mockResolvedValue( stored( {
                tokenHash: hash( 'newer' ),
                previousTokenHash: hash( 'current' ),
                rotatedAt: new Date( Date.now() - 60_000 ),
            } ) );

            await expect( service.rotate( `${SESSION_ID}.current`, {} ) ).rejects.toThrow( UnauthorizedException );
            expect( sessions.delete ).toHaveBeenCalledWith( { id: SESSION_ID } );
        } );

        it( 'keeps the session when the previous token comes back within 30s (two tabs refreshing)', async () => {
            sessions.findOneBy.mockResolvedValue( stored( {
                tokenHash: hash( 'newer' ),
                previousTokenHash: hash( 'current' ),
                rotatedAt: new Date( Date.now() - 10_000 ),
            } ) );

            await expect( service.rotate( `${SESSION_ID}.current`, {} ) ).rejects.toThrow( UnauthorizedException );
            expect( sessions.delete ).not.toHaveBeenCalled();
        } );

        it( 'ends an expired session', async () => {
            sessions.findOneBy.mockResolvedValue( stored( { expiresAt: new Date( Date.now() - 1 ) } ) );

            await expect( service.rotate( `${SESSION_ID}.current`, {} ) ).rejects.toThrow( UnauthorizedException );
            expect( sessions.delete ).toHaveBeenCalledWith( { id: SESSION_ID } );
        } );

        it( 'fails when a concurrent refresh already swapped the token', async () => {
            sessions.findOneBy.mockResolvedValue( stored() );
            sessions.update.mockResolvedValue( { affected: 0 } );

            await expect( service.rotate( `${SESSION_ID}.current`, {} ) ).rejects.toThrow( UnauthorizedException );
        } );
    } );

    describe( 'revokeOthers', () => {
        it( 'keeps the session of the given token', async () => {
            await service.revokeOthers( 'user-1', `${SESSION_ID}.current` );

            expect( sessions.delete ).toHaveBeenCalledWith( { userId: 'user-1', id: Not( SESSION_ID ) } );
        } );

        it( 'ends every session without a token', async () => {
            await service.revokeOthers( 'user-1', undefined );

            expect( sessions.delete ).toHaveBeenCalledWith( { userId: 'user-1' } );
        } );
    } );

    it( 'revoke only deletes the session when the secret matches', async () => {
        await service.revoke( `${SESSION_ID}.current` );

        expect( sessions.delete ).toHaveBeenCalledWith( { id: SESSION_ID, tokenHash: hash( 'current' ) } );
    } );

    it( 'revoke ignores a malformed token', async () => {
        await service.revoke( 'garbage' );

        expect( sessions.delete ).not.toHaveBeenCalled();
    } );
} );
