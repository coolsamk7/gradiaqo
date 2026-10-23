import {
    BadRequestException,
    ConflictException,
    HttpException,
    HttpStatus,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import { EmailCodePurpose, User } from '@studylog/database';
import * as argon2 from 'argon2';
import type { DataSource } from 'typeorm';

import type { FakeDataSource } from '../../test/unit/fake-data-source.js';
import { fakeDataSource } from '../../test/unit/fake-data-source.js';
import type { MailService } from '../mail/mail.service.js';
import type { UsersService } from '../users/users.service.js';
import type { EmailCodesService } from './email-codes.service.js';
import { WRONG_CODE } from './email-codes.service.js';
import type { SessionsService } from './sessions.service.js';
import { VerificationService } from './verification.service.js';

const SAM = { id: 'u', email: 'sam@example.com', firstName: 'Sam', emailVerifiedAt: null as Date | null };

describe( 'VerificationService', () => {
    let db: FakeDataSource;
    let users: { findByIdOrFail: ReturnType<typeof vi.fn> };
    let sessions: { revokeOthers: ReturnType<typeof vi.fn> };
    let codes: Record<'issue' | 'discard' | 'consume', ReturnType<typeof vi.fn>>;
    let mail: { send: ReturnType<typeof vi.fn> };
    let service: VerificationService;

    beforeEach( () => {
        // Failures are logged on purpose; keep test output clean.
        vi.spyOn( Logger.prototype, 'error' ).mockImplementation( () => undefined );
        vi.spyOn( Logger.prototype, 'warn' ).mockImplementation( () => undefined );
        db = fakeDataSource();
        users = { findByIdOrFail: vi.fn().mockResolvedValue( SAM ) };
        sessions = { revokeOthers: vi.fn() };
        codes = { issue: vi.fn().mockResolvedValue( '482913' ), discard: vi.fn(), consume: vi.fn() };
        mail = { send: vi.fn() };
        service = new VerificationService(
            db as unknown as DataSource,
            users as unknown as UsersService,
            sessions as unknown as SessionsService,
            codes as unknown as EmailCodesService,
            mail as unknown as MailService,
        );
    } );

    describe( 'welcome', () => {
        it( 'emails a verification code after signup', async () => {
            await service.welcome( SAM );

            expect( codes.issue ).toHaveBeenCalledWith( 'u', EmailCodePurpose.VerifyEmail );
            expect( mail.send ).toHaveBeenCalledWith( expect.objectContaining( {
                to: 'sam@example.com',
                subject: '482913 is your StudyLog code',
                text: expect.stringContaining( 'Hi Sam,' ) as unknown,
            } ) );
        } );

        it( 'never fails signup when the email can\'t be sent, and frees the code for a resend', async () => {
            mail.send.mockRejectedValue( new Error( 'SMTP down' ) );

            await expect( service.welcome( SAM ) ).resolves.toBeUndefined();
            expect( codes.discard ).toHaveBeenCalledWith( 'u', EmailCodePurpose.VerifyEmail );
        } );
    } );

    describe( 'resend', () => {
        it( 'sends a new code to an unverified user', async () => {
            await service.resend( 'u' );

            expect( users.findByIdOrFail ).toHaveBeenCalledWith( 'u' );
            expect( mail.send ).toHaveBeenCalledOnce();
        } );

        it( 'refuses once verified', async () => {
            users.findByIdOrFail.mockResolvedValue( { ...SAM, emailVerifiedAt: new Date() } );

            await expect( service.resend( 'u' ) ).rejects.toThrow( ConflictException );
            expect( codes.issue ).not.toHaveBeenCalled();
        } );

        it( 'says so when the email can\'t be sent, and passes a too-soon refusal on', async () => {
            mail.send.mockRejectedValue( new Error( 'SMTP down' ) );
            await expect( service.resend( 'u' ) ).rejects.toThrow( ServiceUnavailableException );

            codes.issue.mockRejectedValue( new HttpException( 'Wait', HttpStatus.TOO_MANY_REQUESTS ) );
            await expect( service.resend( 'u' ) ).rejects.toMatchObject( { status: HttpStatus.TOO_MANY_REQUESTS } );
        } );
    } );

    describe( 'verify', () => {
        it( 'uses up the code and marks the email verified', async () => {
            const verified = { ...SAM, emailVerifiedAt: new Date(), passwordHash: 'x' };

            users.findByIdOrFail.mockResolvedValueOnce( SAM ).mockResolvedValueOnce( verified );

            const user = await service.verify( 'u', '482913' );

            expect( codes.consume ).toHaveBeenCalledWith( 'u', EmailCodePurpose.VerifyEmail, '482913' );
            expect( db.repo( User ).update ).toHaveBeenCalledWith( { id: 'u' }, { emailVerifiedAt: expect.any( Date ) as unknown } );
            expect( user.emailVerifiedAt ).toBe( verified.emailVerifiedAt );
            expect( user ).not.toHaveProperty( 'passwordHash' );
        } );

        it( 'does nothing for a verified email', async () => {
            users.findByIdOrFail.mockResolvedValue( { ...SAM, emailVerifiedAt: new Date() } );

            await service.verify( 'u', '000000' );

            expect( codes.consume ).not.toHaveBeenCalled();
        } );

        it( 'keeps the email unverified when the code is wrong', async () => {
            codes.consume.mockRejectedValue( new BadRequestException( WRONG_CODE ) );

            await expect( service.verify( 'u', '000000' ) ).rejects.toThrow( WRONG_CODE );
            expect( db.repo( User ).update ).not.toHaveBeenCalled();
        } );
    } );

    describe( 'forgotPassword', () => {
        it( 'emails a reset code to an existing account', async () => {
            db.repo( User ).findOneBy.mockResolvedValue( SAM );

            await service.forgotPassword( 'sam@example.com' );

            expect( db.repo( User ).findOneBy ).toHaveBeenCalledWith( { email: 'sam@example.com' } );
            expect( codes.issue ).toHaveBeenCalledWith( 'u', EmailCodePurpose.ResetPassword );
            expect( mail.send ).toHaveBeenCalledWith( expect.objectContaining( { subject: '482913 is your StudyLog password reset code' } ) );
        } );

        it( 'answers the same for an unknown email, a code asked for too soon, or a failed email', async () => {
            await expect( service.forgotPassword( 'nobody@example.com' ) ).resolves.toBeUndefined();
            expect( codes.issue ).not.toHaveBeenCalled();

            db.repo( User ).findOneBy.mockResolvedValue( SAM );
            codes.issue.mockRejectedValueOnce( new HttpException( 'Wait', HttpStatus.TOO_MANY_REQUESTS ) );
            await expect( service.forgotPassword( 'sam@example.com' ) ).resolves.toBeUndefined();

            mail.send.mockRejectedValueOnce( new Error( 'SMTP down' ) );
            await expect( service.forgotPassword( 'sam@example.com' ) ).resolves.toBeUndefined();
        } );
    } );

    describe( 'resetPassword', () => {
        it( 'sets the new password, verifies the email and signs out every device', async () => {
            db.repo( User ).findOneBy.mockResolvedValue( SAM );

            await service.resetPassword( 'sam@example.com', '482913', 'a-new-password' );

            expect( codes.consume ).toHaveBeenCalledWith( 'u', EmailCodePurpose.ResetPassword, '482913' );
            const [ , changes ] = db.repo( User ).update.mock.calls[0] as [ unknown, { passwordHash: string; emailVerifiedAt: Date } ];

            expect( await argon2.verify( changes.passwordHash, 'a-new-password' ) ).toBe( true );
            expect( changes.emailVerifiedAt ).toBeInstanceOf( Date );
            expect( sessions.revokeOthers ).toHaveBeenCalledWith( 'u', undefined );
        } );

        it( 'keeps when an email was first verified', async () => {
            db.repo( User ).findOneBy.mockResolvedValue( { ...SAM, emailVerifiedAt: new Date( '2026-01-01' ) } );

            await service.resetPassword( 'sam@example.com', '482913', 'a-new-password' );

            expect( db.repo( User ).update.mock.calls[0]?.[1] ).not.toHaveProperty( 'emailVerifiedAt' );
        } );

        it( 'answers an unknown email like a wrong code, and changes nothing on a wrong code', async () => {
            await expect( service.resetPassword( 'nobody@example.com', '482913', 'a-new-password' ) ).rejects.toThrow( WRONG_CODE );

            db.repo( User ).findOneBy.mockResolvedValue( SAM );
            codes.consume.mockRejectedValue( new BadRequestException( WRONG_CODE ) );
            await expect( service.resetPassword( 'sam@example.com', '000000', 'a-new-password' ) ).rejects.toThrow( WRONG_CODE );
            expect( db.repo( User ).update ).not.toHaveBeenCalled();
            expect( sessions.revokeOthers ).not.toHaveBeenCalled();
        } );
    } );
} );
