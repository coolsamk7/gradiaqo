import { registerAs } from '@nestjs/config';

type SmtpConfig = {
    host: string;
    port: number;
    secure: boolean;
    username?: string;
    password?: string;
    fromEmail: string;
    fromName: string;
};

export const smtpConfig = registerAs( 'smtp.config', (): SmtpConfig => {
    const env = process.env;

    const host = env.SMTP_HOST;
    const port = env.SMTP_PORT ? Number( env.SMTP_PORT ) : NaN;
    const username = env.SMTP_USERNAME;
    const password = env.SMTP_PASSWORD;
    const fromEmail = env.SMTP_FROM_EMAIL ?? username;
    const fromName = env.SMTP_FROM_NAME ?? 'Gradiaqo';

    if ( !host ) {
        throw new Error( 'SMTP_HOST is required.' );
    }

    if ( Number.isNaN( port ) ) {
        throw new Error( 'SMTP_PORT must be a valid number.' );
    }

    if ( ( username && !password ) || ( !username && password ) ) {
        throw new Error( 'SMTP_USERNAME and SMTP_PASSWORD must be provided together.' );
    }

    if ( !fromEmail ) {
        throw new Error( 'SMTP_FROM_EMAIL is required when SMTP_USERNAME is not provided.' );
    }

    return {
        host,
        port,
        secure: env.SMTP_SECURE === 'true',
        username,
        password,
        fromEmail,
        fromName,
    };
} );
