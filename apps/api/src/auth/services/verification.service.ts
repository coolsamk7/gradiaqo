import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { EmailCodePurpose, User } from '@studylog/database';
import * as argon2 from 'argon2';
import { DataSource, QueryFailedError } from 'typeorm';

import { MailService } from '../../mail/services/mail.service.js';
import { changeEmailMail, emailChangedMail, resetPasswordMail, verifyEmailMail } from '../../mail/templates.js';
import type { PublicUser } from '../../users/public-user.js';
import { toPublicUser } from '../../users/public-user.js';
import { UsersService } from '../../users/services/users.service.js';
import { CODE_TTL_MINUTES, EmailCodesService, WRONG_CODE } from './email-codes.service.js';
import { SessionsService } from './sessions.service.js';

type Recipient = Pick<User, 'id' | 'email' | 'firstName'>;

const PG_UNIQUE_VIOLATION = '23505';
const EMAIL_TAKEN = 'That email is already used by another account';

/** The email with the code, per purpose. */
const CODE_MAILS = {
    [EmailCodePurpose.VerifyEmail]: verifyEmailMail,
    [EmailCodePurpose.ResetPassword]: resetPasswordMail,
    [EmailCodePurpose.ChangeEmail]: changeEmailMail,
};

/**
 * Proving an email is the user's with an emailed code: after signup, to reset a forgotten password, and before
 * switching to a new address.
 */
@Injectable()
export class VerificationService {
    private readonly logger = new Logger( VerificationService.name );

    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly usersService: UsersService,
        private readonly sessionsService: SessionsService,
        private readonly codes: EmailCodesService,
        private readonly mail: MailService,
    ) {}

    private get users() {
        return this.dataSource.getRepository( User );
    }

    /** After signup. Never throws: the account exists either way, and the user can ask for the code again. */
    async welcome( user: Recipient ): Promise<void> {
        try {
            await this.sendVerification( user );
        } catch ( err ) {
            this.logger.error( `Couldn't send the verification email: ${( err as Error ).message}` );
        }
    }

    /** "Resend code". Refused once verified (409), or within a minute of the last code (429). */
    async resend( userId: string ): Promise<void> {
        const user = await this.usersService.findByIdOrFail( userId );

        if ( user.emailVerifiedAt ) {
            throw new ConflictException( 'Your email is already verified' );
        }

        await this.sendVerification( user );
    }

    /** Checks the code and marks the email verified. Already verified: nothing to do. */
    async verify( userId: string, code: string ): Promise<PublicUser> {
        const user = await this.usersService.findByIdOrFail( userId );

        if ( user.emailVerifiedAt ) {
            return toPublicUser( user );
        }

        await this.codes.consume( userId, EmailCodePurpose.VerifyEmail, code );
        await this.users.update( { id: userId }, { emailVerifiedAt: new Date() } );

        return toPublicUser( await this.usersService.findByIdOrFail( userId ) );
    }

    /**
     * Emails a reset code if there's an account with this email. Always answers the same way, so it can't be
     * used to find out who has an account; problems are only logged.
     */
    async forgotPassword( email: string ): Promise<void> {
        const user = await this.users.findOneBy( { email } );

        if ( !user ) {
            return;
        }

        try {
            await this.send( user, EmailCodePurpose.ResetPassword );
        } catch ( err ) {
            this.logger.warn( `No password reset email sent: ${( err as Error ).message}` );
        }
    }

    /**
     * Sets a new password with a reset code, signs out every device and, since the code proved the email is
     * theirs, marks it verified. An unknown email gets the same answer as a wrong code.
     */
    async resetPassword( email: string, code: string, newPassword: string ): Promise<void> {
        const user = await this.users.findOneBy( { email } );

        if ( !user ) {
            throw new BadRequestException( WRONG_CODE );
        }

        await this.codes.consume( user.id, EmailCodePurpose.ResetPassword, code );
        await this.users.update( { id: user.id }, {
            passwordHash: await argon2.hash( newPassword ),
            ...( user.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() } ),
        } );
        await this.sessionsService.revokeOthers( user.id, undefined );
    }

    /**
     * Starts changing the email: after the password, emails a code to the new address. Nothing changes until the
     * code is entered (confirmEmailChange). Asking again sends a new code and replaces the pending address.
     */
    async requestEmailChange( userId: string, newEmail: string, password: string ): Promise<void> {
        const user = await this.usersService.findByIdWithPassword( userId );

        if ( !user || !( await argon2.verify( user.passwordHash, password ) ) ) {
            throw new UnauthorizedException( 'Wrong password' );
        }
        if ( newEmail === user.email ) {
            throw new BadRequestException( 'That\'s already your email' );
        }
        if ( await this.usersService.existsByEmail( newEmail ) ) {
            throw new ConflictException( EMAIL_TAKEN );
        }

        await this.send( user, EmailCodePurpose.ChangeEmail, newEmail );
    }

    /**
     * Switches to the new address with the code sent to it, which also verifies it, and tells the old address.
     * Refused (409) if someone signed up with that address in the meantime.
     */
    async confirmEmailChange( userId: string, code: string ): Promise<PublicUser> {
        const user = await this.usersService.findByIdOrFail( userId );
        const { newEmail } = await this.codes.consume( userId, EmailCodePurpose.ChangeEmail, code );
        // Codes for changing the email always have the new address.
        const email = newEmail!;

        try {
            await this.users.update( { id: userId }, { email, emailVerifiedAt: new Date() } );
        } catch ( err ) {
            if ( isUniqueViolation( err ) ) {
                throw new ConflictException( EMAIL_TAKEN );
            }
            throw err;
        }

        try {
            await this.mail.send( emailChangedMail( user.email, user.firstName, email ) );
        } catch ( err ) {
            this.logger.warn( `Couldn't tell the old address about the email change: ${( err as Error ).message}` );
        }

        return toPublicUser( await this.usersService.findByIdOrFail( userId ) );
    }

    private sendVerification( user: Recipient ): Promise<void> {
        return this.send( user, EmailCodePurpose.VerifyEmail );
    }

    /**
     * Issues a code and emails it (to `newEmail` when changing the email). If the email can't be sent, the code
     * is thrown away (so asking again isn't refused) and it fails with 503.
     */
    private async send( user: Recipient, purpose: EmailCodePurpose, newEmail: string | null = null ): Promise<void> {
        const code = await this.codes.issue( user.id, purpose, { newEmail } );
        const mail = CODE_MAILS[purpose]( newEmail ?? user.email, user.firstName, code, CODE_TTL_MINUTES );

        try {
            await this.mail.send( mail );
        } catch ( err ) {
            await this.codes.discard( user.id, purpose );
            this.logger.error( `Email to user ${user.id} failed: ${( err as Error ).message}` );
            throw new ServiceUnavailableException( 'We couldn\'t send the email. Please try again in a minute.' );
        }
    }
}

function isUniqueViolation( err: unknown ): boolean {
    return err instanceof QueryFailedError && ( err.driverError as { code?: string } ).code === PG_UNIQUE_VIOLATION;
}
