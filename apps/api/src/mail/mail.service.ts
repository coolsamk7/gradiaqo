import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import { createTransport } from 'nodemailer';

export interface Mail {
    to: string;
    subject: string;
    /** The whole message as plain text; `html` is the same message, formatted. */
    text: string;
    html: string;
}

/**
 * Sends email over SMTP (see SMTP_* in the config): Mailpit in development, the provider's relay in production.
 * Nothing here knows which provider it is.
 */
@Injectable()
export class MailService {
    private readonly logger = new Logger( MailService.name );
    private readonly transport: Transporter;
    private readonly from: string;

    constructor( config: ConfigService ) {
        const user = config.getOrThrow<string>( 'SMTP_USER' );

        this.from = config.getOrThrow<string>( 'MAIL_FROM' );
        this.transport = createTransport( {
            host: config.getOrThrow<string>( 'SMTP_HOST' ),
            port: config.getOrThrow<number>( 'SMTP_PORT' ),
            secure: config.getOrThrow<boolean>( 'SMTP_SECURE' ),
            auth: user ? { user, pass: config.getOrThrow<string>( 'SMTP_PASSWORD' ) } : undefined,
        } );
    }

    /** Rejects if the SMTP server didn't accept the message. */
    async send( mail: Mail ): Promise<void> {
        await this.transport.sendMail( { from: this.from, ...mail } );
        this.logger.log( `Sent "${mail.subject}"` );
    }
}
