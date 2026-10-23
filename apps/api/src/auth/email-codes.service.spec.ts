import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { EmailCode, EmailCodePurpose } from '@studylog/database';
import * as argon2 from 'argon2';
import type { DataSource } from 'typeorm';

import type { FakeDataSource } from '../../test/unit/fake-data-source.js';
import { fakeDataSource } from '../../test/unit/fake-data-source.js';
import { EmailCodesService, MAX_ATTEMPTS, WRONG_CODE } from './email-codes.service.js';

const NOW = new Date( '2026-10-23T10:00:00Z' );
const VERIFY = EmailCodePurpose.VerifyEmail;

describe( 'EmailCodesService', () => {
    let db: FakeDataSource;
    let service: EmailCodesService;

    beforeEach( () => {
        db = fakeDataSource();
        service = new EmailCodesService( db as unknown as DataSource );
    } );

    const live = async ( overrides: Partial<EmailCode> = {} ) => ( {
        id: 'code-1',
        codeHash: await argon2.hash( '482913' ),
        attempts: 0,
        expiresAt: new Date( NOW.getTime() + 60_000 ),
        createdAt: new Date( NOW.getTime() - 120_000 ),
        ...overrides,
    } );

    describe( 'issue', () => {
        it( 'stores only the hash of a new 6-digit code, valid for 15 minutes, replacing any earlier one', async () => {
            const code = await service.issue( 'u', VERIFY, NOW );
            const [ row, conflict ] = db.repo( EmailCode ).upsert.mock.calls[0] as [ Record<string, unknown>, string[] ];

            expect( code ).toMatch( /^\d{6}$/ );
            expect( row ).toMatchObject( {
                userId: 'u',
                purpose: VERIFY,
                attempts: 0,
                expiresAt: new Date( NOW.getTime() + 15 * 60_000 ),
                createdAt: NOW,
            } );
            expect( row.codeHash ).not.toContain( code );
            expect( await argon2.verify( row.codeHash as string, code ) ).toBe( true );
            expect( conflict ).toEqual( [ 'userId', 'purpose' ] );
        } );

        it( 'pads short codes with zeros', async () => {
            const codes = await Promise.all( Array.from( { length: 30 }, () => service.issue( 'u', VERIFY, NOW ) ) );

            expect( codes.every( ( code ) => code.length === 6 ) ).toBe( true );
        } );

        it( 'refuses a new code within a minute of the last one', async () => {
            db.repo( EmailCode ).findOneBy.mockResolvedValue( await live( { createdAt: new Date( NOW.getTime() - 59_000 ) } ) );

            const attempt = service.issue( 'u', VERIFY, NOW );

            await expect( attempt ).rejects.toThrow( HttpException );
            await expect( attempt ).rejects.toMatchObject( { status: HttpStatus.TOO_MANY_REQUESTS } );
            expect( db.repo( EmailCode ).upsert ).not.toHaveBeenCalled();
        } );

        it( 'allows a new code once a minute has passed', async () => {
            db.repo( EmailCode ).findOneBy.mockResolvedValue( await live( { createdAt: new Date( NOW.getTime() - 60_000 ) } ) );

            await expect( service.issue( 'u', VERIFY, NOW ) ).resolves.toMatch( /^\d{6}$/ );
        } );
    } );

    it( 'discards a code', async () => {
        await service.discard( 'u', VERIFY );

        expect( db.repo( EmailCode ).delete ).toHaveBeenCalledWith( { userId: 'u', purpose: VERIFY } );
    } );

    describe( 'consume', () => {
        it( 'uses up the right code', async () => {
            db.repo( EmailCode ).findOneBy.mockResolvedValue( await live() );

            await service.consume( 'u', VERIFY, '482913', NOW );

            expect( db.repo( EmailCode ).findOneBy ).toHaveBeenCalledWith( { userId: 'u', purpose: VERIFY } );
            expect( db.repo( EmailCode ).delete ).toHaveBeenCalledWith( { id: 'code-1' } );
        } );

        it( 'rejects when there is no code, or it has expired', async () => {
            await expect( service.consume( 'u', VERIFY, '482913', NOW ) ).rejects.toThrow( WRONG_CODE );

            db.repo( EmailCode ).findOneBy.mockResolvedValue( await live( { expiresAt: NOW } ) );
            await expect( service.consume( 'u', VERIFY, '482913', NOW ) ).rejects.toThrow( BadRequestException );
            expect( db.repo( EmailCode ).delete ).not.toHaveBeenCalled();
        } );

        it( 'counts a wrong guess', async () => {
            db.repo( EmailCode ).findOneBy.mockResolvedValue( await live( { attempts: 1 } ) );

            await expect( service.consume( 'u', VERIFY, '000000', NOW ) ).rejects.toThrow( WRONG_CODE );
            expect( db.repo( EmailCode ).update ).toHaveBeenCalledWith( { id: 'code-1' }, { attempts: 2 } );
            expect( db.repo( EmailCode ).delete ).not.toHaveBeenCalled();
        } );

        it( 'throws the code away after too many wrong guesses', async () => {
            db.repo( EmailCode ).findOneBy.mockResolvedValue( await live( { attempts: MAX_ATTEMPTS - 1 } ) );

            await expect( service.consume( 'u', VERIFY, '000000', NOW ) ).rejects.toThrow( 'Too many wrong codes. Ask for a new one.' );
            expect( db.repo( EmailCode ).delete ).toHaveBeenCalledWith( { id: 'code-1' } );
            expect( db.repo( EmailCode ).update ).not.toHaveBeenCalled();
        } );

        it( 'uses the current time by default', async () => {
            db.repo( EmailCode ).findOneBy.mockResolvedValue( await live( { expiresAt: new Date( Date.now() + 60_000 ), createdAt: new Date() } ) );

            await expect( service.consume( 'u', VERIFY, '482913' ) ).resolves.toBeUndefined();
            await expect( service.issue( 'u', VERIFY ) ).rejects.toMatchObject( { status: HttpStatus.TOO_MANY_REQUESTS } );
        } );
    } );
} );
