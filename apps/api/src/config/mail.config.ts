import { registerAs } from '@nestjs/config';

import { validateEnv } from './env.js';

/** Outgoing email over SMTP. Inject with `@Inject( mailConfig.KEY )`. */
export const mailConfig = registerAs( 'mail', () => {
    const env = validateEnv( process.env );

    return {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        user: env.SMTP_USER,
        password: env.SMTP_PASSWORD,
        from: env.MAIL_FROM,
    };
} );
