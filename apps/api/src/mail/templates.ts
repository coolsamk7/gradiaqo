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

export interface InvitationDetails {
    /** Who invited them, or null if that account is gone. */
    inviter: string | null;
    organization: string;
    role: string;
    /** Where to accept it. */
    url: string;
    days: number;
}

/** To someone invited to an organization, who may not have an account yet. */
export function invitationMail( to: string, { inviter, organization, role, url, days }: InvitationDetails ): Mail {
    const who = inviter ?? 'Someone';
    const body = `${who} invited you to join ${organization} on StudyLog as ${role === 'member' ? 'a' : 'an'} ${role}.`;
    const how = `Log in with this email address, or sign up with it if you're new, to accept: ${url}`;
    const outro = `The invitation expires in ${days} days. If you weren't expecting it, you can ignore this email.`;

    return {
        to,
        subject: `${who} invited you to ${organization} on StudyLog`,
        text: `Hi,\n\n${body}\n\n${how}\n\n${outro}\n\nStudyLog`,
        html: '<p>Hi,</p>'
            + `<p>${escape( body )}</p>`
            + '<p>Log in with this email address, or sign up with it if you\'re new, to accept:</p>'
            + `<p><a href="${escape( url )}">Open StudyLog</a></p>`
            + `<p>${escape( outro )}</p>`
            + '<p>StudyLog</p>',
    };
}
