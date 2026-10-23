import type { Mail } from './mail.service.js';

/*
 * The emails StudyLog sends. Short, plain and the same in text and HTML, so they read well everywhere and don't
 * look like marketing to spam filters.
 */

const escape = ( value: string ) => value.replace( /[&<>"']/g, ( char ) => `&#${char.charCodeAt( 0 )};` );

/** A code in a simple layout: greeting, what it's for, the code, and how long it lasts. */
function codeMail(
    to: string,
    firstName: string,
    subject: string,
    intro: string,
    code: string,
    minutes: number,
): Mail {
    const outro = `It expires in ${minutes} minutes. If you didn't ask for it, you can ignore this email.`;

    return {
        to,
        subject,
        text: `Hi ${firstName},\n\n${intro}\n\n${code}\n\n${outro}\n\nStudyLog`,
        html: `<p>Hi ${escape( firstName )},</p>`
            + `<p>${escape( intro )}</p>`
            + `<p style="font-size:24px;font-weight:600;letter-spacing:4px;font-family:monospace">${code}</p>`
            + `<p>${escape( outro )}</p>`
            + '<p>StudyLog</p>',
    };
}

export function verifyEmailMail( to: string, firstName: string, code: string, minutes: number ): Mail {
    return codeMail(
        to,
        firstName,
        `${code} is your StudyLog code`,
        'Enter this code in StudyLog to verify your email:',
        code,
        minutes,
    );
}

export function resetPasswordMail( to: string, firstName: string, code: string, minutes: number ): Mail {
    return codeMail(
        to,
        firstName,
        `${code} is your StudyLog password reset code`,
        'Someone asked to reset your StudyLog password. Enter this code to choose a new one:',
        code,
        minutes,
    );
}
