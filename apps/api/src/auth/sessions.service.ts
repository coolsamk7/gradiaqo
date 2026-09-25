import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Session } from '@studylog/database';
import { Not, Repository } from 'typeorm';

export interface ClientMeta {
    userAgent?: string;
    ip?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// A just-rotated token reused within this window is most likely two tabs refreshing
// at the same moment, not theft, so the session is kept.
const REUSE_GRACE_MS = 30_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Refresh tokens look like `<sessionId>.<secret>`. Only a hash of the secret is stored.
 * Carrying the session id means any stale token, however old, still points at its
 * session, so reuse of a rotated token can always be detected.
 */
@Injectable()
export class SessionsService {
    private readonly ttlMs: number;

    constructor(
        @InjectRepository( Session ) private readonly sessions: Repository<Session>,
        config: ConfigService,
    ) {
        this.ttlMs = config.getOrThrow<number>( 'REFRESH_TOKEN_TTL_DAYS' ) * DAY_MS;
    }

    /** Starts a new session and returns its refresh token. */
    async create( userId: string, meta: ClientMeta ): Promise<string> {
        const id = randomUUID();
        const secret = generateSecret();
        const now = new Date();

        await this.sessions.insert( {
            id,
            userId,
            tokenHash: hashSecret( secret ),
            expiresAt: new Date( now.getTime() + this.ttlMs ),
            lastUsedAt: now,
            ...toMetaColumns( meta ),
        } );

        return `${id}.${secret}`;
    }

    /** Swaps a valid refresh token for a new one and extends the session. */
    async rotate( token: string, meta: ClientMeta ): Promise<{ userId: string; token: string }> {
        const parsed = parseToken( token );
        const session = parsed && ( await this.sessions.findOneBy( { id: parsed.sessionId } ) );

        if ( !parsed || !session ) {
            throw new UnauthorizedException();
        }

        const hash = hashSecret( parsed.secret );
        const now = new Date();

        if ( hash !== session.tokenHash ) {
            const isConcurrentRefresh =
                hash === session.previousTokenHash
                && session.rotatedAt !== null
                && now.getTime() - session.rotatedAt.getTime() <= REUSE_GRACE_MS;

            if ( !isConcurrentRefresh ) {
                // A token this session already replaced came back: assume it was stolen and
                // end the session, so both the thief and the user have to log in again.
                await this.sessions.delete( { id: session.id } );
            }
            throw new UnauthorizedException();
        }

        if ( session.expiresAt <= now ) {
            await this.sessions.delete( { id: session.id } );
            throw new UnauthorizedException();
        }

        const newSecret = generateSecret();
        // Matching on the old hash makes this a compare-and-swap: of two concurrent
        // refreshes with the same token, only one succeeds.
        const result = await this.sessions.update(
            { id: session.id, tokenHash: hash },
            {
                tokenHash: hashSecret( newSecret ),
                previousTokenHash: hash,
                rotatedAt: now,
                lastUsedAt: now,
                expiresAt: new Date( now.getTime() + this.ttlMs ),
                ...toMetaColumns( meta ),
            },
        );

        if ( !result.affected ) {
            throw new UnauthorizedException();
        }

        return { userId: session.userId, token: `${session.id}.${newSecret}` };
    }

    /** Ends every session of the user except the one `keepToken` belongs to (e.g. after a password change). */
    async revokeOthers( userId: string, keepToken: string | undefined ): Promise<void> {
        const keep = keepToken ? parseToken( keepToken ) : null;

        await this.sessions.delete( {
            userId,
            ...( keep && { id: Not( keep.sessionId ) } ),
        } );
    }

    async revoke( token: string ): Promise<void> {
        const parsed = parseToken( token );

        if ( parsed ) {
            await this.sessions.delete( { id: parsed.sessionId, tokenHash: hashSecret( parsed.secret ) } );
        }
    }
}

function parseToken( token: string ): { sessionId: string; secret: string } | null {
    const dot = token.indexOf( '.' );
    const sessionId = token.slice( 0, dot );
    const secret = token.slice( dot + 1 );

    return dot > 0 && secret && UUID_RE.test( sessionId ) ? { sessionId, secret } : null;
}

function generateSecret(): string {
    return randomBytes( 32 ).toString( 'base64url' );
}

// Secrets are 256 bits of randomness, so a fast hash is enough (unlike passwords).
function hashSecret( secret: string ): string {
    return createHash( 'sha256' ).update( secret ).digest( 'hex' );
}

function toMetaColumns( meta: ClientMeta ): Pick<Session, 'userAgent' | 'ip'> {
    return {
        userAgent: meta.userAgent?.slice( 0, 512 ) ?? null,
        ip: meta.ip?.slice( 0, 64 ) ?? null,
    };
}
