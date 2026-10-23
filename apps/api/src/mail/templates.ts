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

export function changeEmailMail( to: string, firstName: string, code: string, minutes: number ): Mail {
    return codeMail(
        to,
        firstName,
        `${code} is your StudyLog code`,
        'Enter this code in StudyLog to use this address for your account:',
        code,
        minutes,
    );
}

/** To the old address once the email has changed, so a change the owner didn't make doesn't go unnoticed. */
export function emailChangedMail( to: string, firstName: string, newEmail: string ): Mail {
    const body = `The email for your StudyLog account was changed to ${newEmail}. From now on, log in with that address.`;
    const outro = 'If this wasn\'t you, someone knows your password: contact the StudyLog team right away.';

    return {
        to,
        subject: 'Your StudyLog email was changed',
        text: `Hi ${firstName},\n\n${body}\n\n${outro}\n\nStudyLog`,
        html: `<p>Hi ${escape( firstName )},</p><p>${escape( body )}</p><p>${escape( outro )}</p><p>StudyLog</p>`,
    };
}
