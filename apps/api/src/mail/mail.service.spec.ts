import type { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';

import { MailService } from './mail.service.js';
import { resetPasswordMail, verifyEmailMail } from './templates.js';

vi.mock( 'nodemailer', () => ( { createTransport: vi.fn() } ) );

const config = ( values: Record<string, unknown> ) => ( {
    getOrThrow: ( key: string ) => ( {
        SMTP_HOST: 'smtp-relay.brevo.com',
        SMTP_PORT: 587,
        SMTP_SECURE: false,
        SMTP_USER: 'me@example.com',
        SMTP_PASSWORD: 'key',
        MAIL_FROM: 'StudyLog <no-reply@example.com>',
        ...values,
    } )[key],
} ) as unknown as ConfigService;

describe( 'MailService', () => {
    const sendMail = vi.fn();

    beforeEach( () => {
        vi.mocked( createTransport ).mockReturnValue( { sendMail } as never );
        sendMail.mockReset();
    } );

    it( 'sends over SMTP with the configured server, login and sender', async () => {
        const service = new MailService( config( {} ) );

        await service.send( { to: 'sam@example.com', subject: 'Hi', text: 'Hello', html: '<p>Hello</p>' } );

        expect( createTransport ).toHaveBeenCalledWith( {
            host: 'smtp-relay.brevo.com',
            port: 587,
            secure: false,
            auth: { user: 'me@example.com', pass: 'key' },
        } );
        expect( sendMail ).toHaveBeenCalledWith( {
            from: 'StudyLog <no-reply@example.com>',
            to: 'sam@example.com',
            subject: 'Hi',
            text: 'Hello',
            html: '<p>Hello</p>',
        } );
    } );

    it( 'logs in only when there is a user (Mailpit needs none), and passes failures on', async () => {
        const service = new MailService( config( { SMTP_HOST: 'localhost', SMTP_PORT: 1025, SMTP_USER: '' } ) );

        expect( vi.mocked( createTransport ).mock.calls.at( -1 )?.[0] ).toMatchObject( { host: 'localhost', port: 1025, auth: undefined } );

        sendMail.mockRejectedValue( new Error( 'refused' ) );
        await expect( service.send( { to: 'a@b.co', subject: 's', text: 't', html: 'h' } ) ).rejects.toThrow( 'refused' );
    } );
} );

describe( 'mail templates', () => {
    it( 'puts the code in the subject, text and HTML, with how long it lasts', () => {
        const mail = verifyEmailMail( 'sam@example.com', 'Sam', '482913', 15 );

        expect( mail.to ).toBe( 'sam@example.com' );
        expect( mail.subject ).toBe( '482913 is your StudyLog code' );
        expect( mail.text ).toBe( 'Hi Sam,\n\nEnter this code in StudyLog to verify your email:\n\n482913\n\n'
            + 'It expires in 15 minutes. If you didn\'t ask for it, you can ignore this email.\n\nStudyLog' );
        expect( mail.html ).toContain( '>482913</p>' );
        expect( resetPasswordMail( 'sam@example.com', 'Sam', '000123', 15 ).text ).toContain( 'reset your StudyLog password' );
    } );

    it( 'escapes names in the HTML', () => {
        expect( verifyEmailMail( 'a@b.co', '<b>Sam</b> & "co"', '1', 15 ).html )
            .toContain( 'Hi &#60;b&#62;Sam&#60;/b&#62; &#38; &#34;co&#34;,' );
    } );
} );
