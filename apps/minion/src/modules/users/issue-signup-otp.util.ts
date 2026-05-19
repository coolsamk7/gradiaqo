import type { MinionContext } from '@gradiaqo/nestjs-shared';
import { SmtpMailerService } from './services/smtp-mailer.service';
import { UserEmailOtpService } from './services/user-email-otp.service';

type IssueSignupOtpArgs = {
    step: MinionContext['step'];
    userId: string;
    email: string;
    smtpMailerService: SmtpMailerService;
    userEmailOtpService: UserEmailOtpService;
};

export async function issueSignupOtp( {
    step,
    userId,
    email,
    smtpMailerService,
    userEmailOtpService,
}: IssueSignupOtpArgs ) {
    const otpPayload = await step.run( 'issue-email-otp', async () => {
        const otp = await userEmailOtpService.issueOtp( {
            userId,
            email,
        } );

        return {
            ...otp,
            expiresAt: otp.expiresAt.toISOString(),
        };
    } );
    const expiresAt = new Date( otpPayload.expiresAt );

    await step.run( 'send-email-otp', async () => {
        await smtpMailerService.sendSignupOtpEmail( {
            email,
            otp: otpPayload.otp,
            expiresAt,
        } );
    } );

    return {
        userId,
        email,
        expiresAt: expiresAt.toISOString(),
    };
}
