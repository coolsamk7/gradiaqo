import {
    BadRequestException,
    ConflictException,
    HttpException,
    HttpStatus,
    Logger,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';
import { EmailCodePurpose, User } from '@studylog/database';
import * as argon2 from 'argon2';
import type { DataSource } from 'typeorm';
import { QueryFailedError } from 'typeorm';

import type { EmailCodesService } from '../../../../src/auth/services/email-codes.service.js';
import { WRONG_CODE } from '../../../../src/auth/services/email-codes.service.js';
import type { SessionsService } from '../../../../src/auth/services/sessions.service.js';
import { VerificationService } from '../../../../src/auth/services/verification.service.js';
import type { MailService } from '../../../../src/mail/services/mail.service.js';
import type { UsersService } from '../../../../src/users/services/users.service.js';
import type { FakeDataSource } from '../../fake-data-source.js';
import { fakeDataSource } from '../../fake-data-source.js';

const SAM = { id: 'u', email: 'sam@example.com', firstName: 'Sam', emailVerifiedAt: null as Date | null };

describe( 'VerificationService', () => {
    let db: FakeDataSource;
    let users: Record<'findByIdOrFail' | 'findByIdWithPassword' | 'existsByEmail', ReturnType<typeof vi.fn>>;
    let sessions: { revokeOthers: ReturnType<typeof vi.fn> };
    let codes: Record<'issue' | 'discard' | 'consume', ReturnType<typeof vi.fn>>;
    let mail: { send: ReturnType<typeof vi.fn> };
    let service: VerificationService;

    beforeEach( () => {
        // Failures are logged on purpose; keep test output clean.
        vi.spyOn( Logger.prototype, 'error' ).mockImplementation( () => undefined );
        vi.spyOn( Logger.prototype, 'warn' ).mockImplementation( () => undefined );
        db = fakeDataSource();
        users = {
            findByIdOrFail: vi.fn().mockResolvedValue( SAM ),
            findByIdWithPassword: vi.fn(),
            existsByEmail: vi.fn().mockResolvedValue( false ),
        };
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

            expect( codes.issue ).toHaveBeenCalledWith( 'u', EmailCodePurpose.VerifyEmail, { newEmail: null } );
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
            expect( codes.issue ).toHaveBeenCalledWith( 'u', EmailCodePurpose.ResetPassword, { newEmail: null } );
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

    describe( 'requestEmailChange', () => {
        beforeEach( async () => {
            users.findByIdWithPassword.mockResolvedValue( { ...SAM, passwordHash: await argon2.hash( 'right-password' ) } );
        } );

        it( 'emails a code to the new address, keeping the address with the code', async () => {
            await service.requestEmailChange( 'u', 'sam@new.co', 'right-password' );

            expect( users.existsByEmail ).toHaveBeenCalledWith( 'sam@new.co' );
            expect( codes.issue ).toHaveBeenCalledWith( 'u', EmailCodePurpose.ChangeEmail, { newEmail: 'sam@new.co' } );
            expect( mail.send ).toHaveBeenCalledWith( expect.objectContaining( {
                to: 'sam@new.co',
                subject: '482913 is your StudyLog code',
                text: expect.stringContaining( 'use this address for your account' ) as unknown,
            } ) );
        } );

        it( 'needs the right password', async () => {
            await expect( service.requestEmailChange( 'u', 'sam@new.co', 'wrong' ) ).rejects.toThrow( UnauthorizedException );

            users.findByIdWithPassword.mockResolvedValue( null );
            await expect( service.requestEmailChange( 'u', 'sam@new.co', 'right-password' ) ).rejects.toThrow( UnauthorizedException );
            expect( codes.issue ).not.toHaveBeenCalled();
        } );

        it( 'refuses the current email, and one another account uses', async () => {
            await expect( service.requestEmailChange( 'u', 'sam@example.com', 'right-password' ) ).rejects.toThrow( BadRequestException );

            users.existsByEmail.mockResolvedValue( true );
            await expect( service.requestEmailChange( 'u', 'taken@new.co', 'right-password' ) )
                .rejects.toThrow( 'That email is already used by another account' );
            expect( codes.issue ).not.toHaveBeenCalled();
        } );
    } );

    describe( 'confirmEmailChange', () => {
        const changed = { ...SAM, email: 'sam@new.co', emailVerifiedAt: new Date() };

        beforeEach( () => {
            codes.consume.mockResolvedValue( { newEmail: 'sam@new.co' } );
            users.findByIdOrFail.mockResolvedValueOnce( SAM ).mockResolvedValueOnce( changed );
        } );

        it( 'switches to the verified new address and tells the old one', async () => {
            const user = await service.confirmEmailChange( 'u', '482913' );

            expect( codes.consume ).toHaveBeenCalledWith( 'u', EmailCodePurpose.ChangeEmail, '482913' );
            expect( db.repo( User ).update ).toHaveBeenCalledWith(
                { id: 'u' },
                { email: 'sam@new.co', emailVerifiedAt: expect.any( Date ) as unknown },
            );
            expect( mail.send ).toHaveBeenCalledWith( expect.objectContaining( {
                to: 'sam@example.com',
                subject: 'Your StudyLog email was changed',
                html: expect.stringContaining( 'changed to sam@new.co' ) as unknown,
            } ) );
            expect( user.email ).toBe( 'sam@new.co' );
        } );

        it( 'still switches when the notice can\'t be sent', async () => {
            mail.send.mockRejectedValue( new Error( 'SMTP down' ) );

            await expect( service.confirmEmailChange( 'u', '482913' ) ).resolves.toMatchObject( { email: 'sam@new.co' } );
        } );

        it( 'changes nothing on a wrong code', async () => {
            codes.consume.mockRejectedValue( new BadRequestException( WRONG_CODE ) );

            await expect( service.confirmEmailChange( 'u', '000000' ) ).rejects.toThrow( WRONG_CODE );
            expect( db.repo( User ).update ).not.toHaveBeenCalled();
        } );

        it( 'refuses if someone signed up with the address in the meantime, and passes other errors on', async () => {
            const taken = new QueryFailedError( 'UPDATE', [], Object.assign( new Error( 'duplicate' ), { code: '23505' } ) );

            db.repo( User ).update.mockRejectedValueOnce( taken );
            await expect( service.confirmEmailChange( 'u', '482913' ) ).rejects.toThrow( ConflictException );

            users.findByIdOrFail.mockResolvedValue( SAM );
            db.repo( User ).update.mockRejectedValueOnce( new Error( 'connection lost' ) );
            await expect( service.confirmEmailChange( 'u', '482913' ) ).rejects.toThrow( 'connection lost' );
            expect( mail.send ).not.toHaveBeenCalled();
        } );
    } );
} );
