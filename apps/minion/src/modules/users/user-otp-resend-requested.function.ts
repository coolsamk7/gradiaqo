import { NestjsInngestFunction } from '@gradiaqo/nestjs-inngest';
import type { MinionContext } from '@gradiaqo/nestjs-shared';
import { Injectable } from '@nestjs/common';
import { issueSignupOtp } from './issue-signup-otp.util';
import { SmtpMailerService } from './services/smtp-mailer.service';
import { UserEmailOtpService } from './services/user-email-otp.service';

@Injectable()
export class UserOtpResendRequestedFunction {
    constructor(
        private readonly smtpMailerService: SmtpMailerService,
        private readonly userEmailOtpService: UserEmailOtpService,
    ) {}

    @NestjsInngestFunction(
        { id: 'users-user-otp-resend-requested-send-email-otp' },
        { event: 'users/user.otp-resend-requested' }
    )
    async handle( { event, step }: MinionContext ) {
        const email = event.data.email;

        if ( !email ) {
            throw new Error( 'users/user.otp-resend-requested event is missing email.' );
        }

        return issueSignupOtp( {
            step,
            userId: event.data.id,
            email,
            smtpMailerService: this.smtpMailerService,
            userEmailOtpService: this.userEmailOtpService,
        } );
    }
}
