import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

type SendSignupOtpEmailArgs = {
    email: string;
    otp: string;
    expiresAt: Date;
};

type SmtpConfig = {
    host: string;
    port: number;
    secure: boolean;
    username?: string;
    password?: string;
    fromEmail: string;
    fromName: string;
};

@Injectable()
export class SmtpMailerService {
    private readonly transporter: Transporter;
    private readonly from: string;

    constructor( private readonly configService: ConfigService ) {
        const smtpConfig = this.configService.getOrThrow<SmtpConfig>( 'smtp.config' );

        this.transporter = createTransport( {
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.secure,
            auth: smtpConfig.username
                ? {
                    user: smtpConfig.username,
                    pass: smtpConfig.password,
                }
                : undefined,
        } );
        this.from = `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`;
    }

    async sendSignupOtpEmail( { email, otp, expiresAt }: SendSignupOtpEmailArgs ) {
        const expiryLabel = expiresAt.toISOString();

        await this.transporter.sendMail( {
            from: this.from,
            to: email,
            subject: 'Your Gradiaqo verification code',
            text: [
                'Welcome to Gradiaqo.',
                '',
                `Your verification code is: ${otp}`,
                'This code expires in 10 minutes.',
                `Expiry time: ${expiryLabel}`,
            ].join( '\n' ),
            html: [
                '<p>Welcome to Gradiaqo.</p>',
                `<p>Your verification code is <strong>${otp}</strong>.</p>`,
                '<p>This code expires in 10 minutes.</p>',
                `<p>Expiry time: <strong>${expiryLabel}</strong></p>`,
            ].join( '' ),
        } );
    }
}
