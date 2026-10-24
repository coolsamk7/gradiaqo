import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import { createTransport } from 'nodemailer';

import { mailConfig } from '../config/mail.config.js';

export interface Mail {
    to: string;
    subject: string;
    /** The whole message as plain text; `html` is the same message, formatted. */
    text: string;
    html: string;
}

/**
 * Sends email over SMTP (see config/mail.config.ts): Mailpit in development, the provider's relay in production.
 * Nothing here knows which provider it is.
 */
@Injectable()
export class MailService {
    private readonly logger = new Logger( MailService.name );
    private readonly transport: Transporter;
    private readonly from: string;

    constructor( @Inject( mailConfig.KEY ) mail: ConfigType<typeof mailConfig> ) {
        this.from = mail.from;
        this.transport = createTransport( {
            host: mail.host,
            port: mail.port,
            secure: mail.secure,
            auth: mail.user ? { user: mail.user, pass: mail.password } : undefined,
        } );
    }

    /** Rejects if the SMTP server didn't accept the message. */
    async send( mail: Mail ): Promise<void> {
        await this.transport.sendMail( { from: this.from, ...mail } );
        this.logger.log( `Sent "${mail.subject}"` );
    }
}
