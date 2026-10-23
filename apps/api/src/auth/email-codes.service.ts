import { randomInt } from 'node:crypto';

import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { EmailCodePurpose } from '@studylog/database';
import { EmailCode } from '@studylog/database';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';

/** How long a code works. */
export const CODE_TTL_MINUTES = 15;
/** How soon a new code can be asked for after the last one was sent. */
export const RESEND_AFTER_SECONDS = 60;
/** Wrong guesses before the code is thrown away (a 6-digit code can't be guessed in 5 tries). */
export const MAX_ATTEMPTS = 5;

export const WRONG_CODE = 'That code is wrong or has expired. Check the latest email, or ask for a new code.';

/**
 * 6-digit codes for emails: one live code per user and purpose, kept only as a hash, valid for a few minutes and
 * for a few guesses, and used once.
 */
@Injectable()
export class EmailCodesService {
    constructor( @InjectDataSource() private readonly dataSource: DataSource ) {}

    private get codes() {
        return this.dataSource.getRepository( EmailCode );
    }

    /** A new code, replacing any earlier one. Refused (429) if the last one was sent less than a minute ago. */
    async issue( userId: string, purpose: EmailCodePurpose, now = new Date() ): Promise<string> {
        const last = await this.codes.findOneBy( { userId, purpose } );

        if ( last && now.getTime() - last.createdAt.getTime() < RESEND_AFTER_SECONDS * 1000 ) {
            throw new HttpException( 'We just sent a code. Wait a minute before asking for another.', HttpStatus.TOO_MANY_REQUESTS );
        }

        const code = String( randomInt( 0, 1_000_000 ) ).padStart( 6, '0' );

        await this.codes.upsert( {
            userId,
            purpose,
            codeHash: await argon2.hash( code ),
            attempts: 0,
            expiresAt: new Date( now.getTime() + CODE_TTL_MINUTES * 60_000 ),
            createdAt: now,
        }, [ 'userId', 'purpose' ] );

        return code;
    }

    /** Throws the code away, e.g. when the email with it couldn't be sent, so a resend isn't refused. */
    async discard( userId: string, purpose: EmailCodePurpose ): Promise<void> {
        await this.codes.delete( { userId, purpose } );
    }

    /** Uses the code up if it's right; otherwise counts the guess and throws (400). */
    async consume( userId: string, purpose: EmailCodePurpose, code: string, now = new Date() ): Promise<void> {
        const live = await this.codes.findOneBy( { userId, purpose } );

        if ( !live || live.expiresAt <= now ) {
            throw new BadRequestException( WRONG_CODE );
        }
        if ( await argon2.verify( live.codeHash, code ) ) {
            await this.codes.delete( { id: live.id } );

            return;
        }
        if ( live.attempts + 1 >= MAX_ATTEMPTS ) {
            await this.codes.delete( { id: live.id } );
            throw new BadRequestException( 'Too many wrong codes. Ask for a new one.' );
        }

        await this.codes.update( { id: live.id }, { attempts: live.attempts + 1 } );
        throw new BadRequestException( WRONG_CODE );
    }
}
