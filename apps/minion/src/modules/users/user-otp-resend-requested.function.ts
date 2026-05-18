import { NestjsInngestFunction } from '@gradiaqo/nestjs-inngest';
import type { MinionContext } from '@gradiaqo/nestjs-shared';
import { Injectable } from '@nestjs/common';
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

        const otpPayload = await step.run( 'issue-email-otp', async () => {
            const otp = await this.userEmailOtpService.issueOtp( {
                userId: event.data.id,
                email,
            } );

            return {
                ...otp,
                expiresAt: otp.expiresAt.toISOString(),
            };
        } );
        const expiresAt = new Date( otpPayload.expiresAt );

        await step.run( 'send-email-otp', async () => {
            await this.smtpMailerService.sendSignupOtpEmail( {
                email,
                otp: otpPayload.otp,
                expiresAt,
            } );
        } );

        return {
            userId: event.data.id,
            email,
            expiresAt: expiresAt.toISOString(),
        };
    }
}
