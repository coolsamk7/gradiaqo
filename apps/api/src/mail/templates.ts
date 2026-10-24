import type { Mail } from './services/mail.service.js';

/*
 * The emails the app sends, under the Gradiaqo brand (BRAND). The text and the HTML say the same thing, so they read
 * well everywhere. The HTML is one shared layout in the web app's colors (apps/web/src/index.css): a header band with
 * the email's title, the message in a card, a short footer. Tables and inline styles only, no images or web fonts, which is what every mail client
 * (Gmail, Outlook, Apple Mail) renders alike; clients without rounded corners or gradients get square, flat ones.
 */

const BRAND = 'Gradiaqo';

/** The web app's design tokens this layout uses. */
const COLOR = {
    bg: '#f3f2ee',
    surface: '#ffffff',
    border: '#e3e3df',
    text: '#0e0e0c',
    muted: '#6b6b64',
    subtle: '#f8f8f6',
    accent: '#5b4cff',
    accentDeep: '#4a3bed',
    accentSoft: '#efedff',
    accentLine: '#d9d4ff',
    onAccent: '#ffffff',
    onAccentMuted: '#dcd8ff',
    warning: '#b45309',
    warningSoft: '#fffbeb',
    warningLine: '#fcd34d',
};
const FONT = '-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif';
const MONO = '\'SFMono-Regular\',Menlo,Consolas,\'Liberation Mono\',monospace';
const TABLE = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';

const escape = ( value: string ) => value.replace( /[&<>"']/g, ( char ) => `&#${char.charCodeAt( 0 )};` );

const paragraph = ( html: string ) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:26px;color:${COLOR.text}">${html}</p>`;

/** Each character of the code in its own tile, like the code inputs in apps. */
const codeTiles = ( code: string ) =>
    `<table ${TABLE} style="margin:8px 0 20px"><tr>${
        [ ...code ].map( ( char, index ) => `${index === 0 ? '' : '<td style="width:8px"></td>'
        }<td align="center" style="width:42px;height:54px;background:${COLOR.accentSoft};border:1px solid ${COLOR.accentLine};`
        + `border-radius:10px;font-family:${MONO};font-size:28px;font-weight:700;color:${COLOR.text}">${escape( char )}</td>` ).join( '' )
    }</tr></table>`;

/** A small rounded label, like "Expires in 15 minutes". */
const pill = ( text: string ) =>
    `<table ${TABLE} style="margin:0 0 24px"><tr>`
    + `<td style="background:${COLOR.subtle};border:1px solid ${COLOR.border};border-radius:999px;padding:6px 14px;`
    + `font-size:13px;line-height:18px;color:${COLOR.muted}">&#9201;&nbsp; ${escape( text )}</td>`
    + '</tr></table>';

/** A boxed note at the end: neutral, or amber for something the reader should act on. */
const note = ( html: string, tone: 'info' | 'warning' ) => {
    const [ background, line, color ] = tone === 'warning'
        ? [ COLOR.warningSoft, COLOR.warningLine, COLOR.warning ]
        : [ COLOR.subtle, COLOR.border, COLOR.muted ];

    return `<table ${TABLE} width="100%"><tr>`
        + `<td style="background:${background};border:1px solid ${line};border-radius:12px;padding:14px 16px;`
        + `font-size:14px;line-height:21px;color:${color}">${html}</td>`
        + '</tr></table>';
};

/** A link that looks like a button, with the plain address below for clients that hide it. */
const button = ( url: string, label: string ) =>
    `<table ${TABLE} style="margin:8px 0 16px"><tr>`
    + `<td style="background:${COLOR.accent};border-radius:12px">`
    + `<a href="${escape( url )}" style="display:inline-block;padding:15px 30px;font-size:16px;font-weight:600;color:${COLOR.onAccent};text-decoration:none">${escape( label )}</a>`
    + '</td></tr></table>'
    + `<p style="margin:0 0 24px;font-size:13px;line-height:20px;color:${COLOR.muted};word-break:break-all">Or open this link: `
    + `<a href="${escape( url )}" style="color:${COLOR.accent}">${escape( url )}</a></p>`;

interface Page {
    subject: string;
    /** The line inboxes show next to the subject; hidden in the email itself. */
    preheader: string;
    /** A character entity shown in a circle next to the title. */
    icon: string;
    title: string;
    content: string;
}

/** The page around every email: the brand and the title in an accent band, the message in a card, a footer. */
function layout( { subject, preheader, icon, title, content }: Page ): string {
    const mark = ( size: number, color: string ) =>
        `<span style="display:inline-block;width:${size}px;height:${size}px;border-radius:${size / 3}px;background:${color};vertical-align:middle"></span>`;

    return '<!doctype html>'
        + '<html lang="en"><head><meta charset="utf-8">'
        + '<meta name="viewport" content="width=device-width,initial-scale=1">'
        // Light only: clients that invert colors for dark mode would make the code tiles unreadable.
        + '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">'
        + `<title>${escape( subject )}</title></head>`
        + `<body style="margin:0;padding:0;background:${COLOR.bg};font-family:${FONT};-webkit-font-smoothing:antialiased">`
        + `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape( preheader )}</div>`
        + `<table ${TABLE} width="100%" style="background:${COLOR.bg}"><tr><td align="center" style="padding:32px 12px">`
        + `<table ${TABLE} width="100%" style="max-width:560px">`
        // The header band: brand, then the icon and the title.
        + `<tr><td style="background:${COLOR.accent};background-image:linear-gradient(135deg,${COLOR.accent} 0%,${COLOR.accentDeep} 100%);`
        + 'border-radius:20px 20px 0 0;padding:28px 32px 32px">'
        + `${mark( 12, COLOR.onAccent )}<span style="margin-left:8px;font-size:16px;font-weight:700;color:${COLOR.onAccent};vertical-align:middle">${BRAND}</span>`
        + `<table ${TABLE} style="margin-top:28px"><tr>`
        + '<td style="width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,0.16);text-align:center;'
        + `font-size:24px;line-height:48px;color:${COLOR.onAccent}">${icon}</td>`
        + `<td style="padding-left:16px;font-size:24px;line-height:30px;font-weight:700;letter-spacing:-0.3px;color:${COLOR.onAccent}">${escape( title )}</td>`
        + '</tr></table>'
        + '</td></tr>'
        // The message.
        + `<tr><td style="background:${COLOR.surface};border:1px solid ${COLOR.border};border-top:0;border-radius:0 0 20px 20px;padding:32px">${content}</td></tr>`
        // The footer.
        + `<tr><td align="center" style="padding:24px 16px 0;font-size:12px;line-height:18px;color:${COLOR.muted}">`
        + `<p style="margin:0 0 8px">${mark( 8, COLOR.accent )}<span style="margin-left:6px;font-weight:700;color:${COLOR.text};vertical-align:middle">${BRAND}</span></p>`
        + `<p style="margin:0">You're getting this email because of your ${BRAND} account, or an invitation to one.<br>`
        + `${BRAND} never asks for your password by email.</p>`
        + '</td></tr>'
        + '</table></td></tr></table></body></html>';
}

interface CodeMail {
    subject: string;
    title: string;
    icon: string;
    intro: string;
}

/** A code: greeting, what it's for, the code, and how long it lasts. */
function codeMail(
    to: string,
    firstName: string,
    code: string,
    minutes: number,
    { subject, title, icon, intro }: CodeMail,
): Mail {
    const ignore = 'If you didn\'t ask for it, you can ignore this email.';

    return {
        to,
        subject,
        text: `Hi ${firstName},\n\n${intro}\n\n${code}\n\nIt expires in ${minutes} minutes. ${ignore}\n\n${BRAND}`,
        html: layout( {
            subject,
            preheader: `Your code is ${code}. It expires in ${minutes} minutes.`,
            icon,
            title,
            content: paragraph( `Hi ${escape( firstName )},` ) + paragraph( escape( intro ) ) + codeTiles( code )
                + pill( `Expires in ${minutes} minutes` ) + note( '<strong>Didn\'t ask for this?</strong> You can safely ignore this email.', 'info' ),
        } ),
    };
}

export function verifyEmailMail( to: string, firstName: string, code: string, minutes: number ): Mail {
    return codeMail( to, firstName, code, minutes, {
        subject: `${code} is your ${BRAND} code`,
        title: 'Verify your email',
        icon: '&#9993;',
        intro: `Enter this code in ${BRAND} to verify your email:`,
    } );
}

export function resetPasswordMail( to: string, firstName: string, code: string, minutes: number ): Mail {
    return codeMail( to, firstName, code, minutes, {
        subject: `${code} is your ${BRAND} password reset code`,
        title: 'Reset your password',
        icon: '&#128273;',
        intro: `Someone asked to reset your ${BRAND} password. Enter this code to choose a new one:`,
    } );
}

export function changeEmailMail( to: string, firstName: string, code: string, minutes: number ): Mail {
    return codeMail( to, firstName, code, minutes, {
        subject: `${code} is your ${BRAND} code`,
        title: 'Confirm your new email',
        icon: '&#9993;',
        intro: `Enter this code in ${BRAND} to use this address for your account:`,
    } );
}

/** To the old address once the email has changed, so a change the owner didn't make doesn't go unnoticed. */
export function emailChangedMail( to: string, firstName: string, newEmail: string ): Mail {
    const subject = `Your ${BRAND} email was changed`;
    const body = `The email for your ${BRAND} account was changed to ${newEmail}. From now on, log in with that address.`;
    const outro = `If this wasn't you, someone knows your password: contact the ${BRAND} team right away.`;

    return {
        to,
        subject,
        text: `Hi ${firstName},\n\n${body}\n\n${outro}\n\n${BRAND}`,
        html: layout( {
            subject,
            preheader: body,
            icon: '&#128274;',
            title: 'Your email was changed',
            content: paragraph( `Hi ${escape( firstName )},` ) + paragraph( escape( body ) )
                + note( `<strong>${escape( outro )}</strong>`, 'warning' ),
        } ),
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
    const subject = `${who} invited you to ${organization} on ${BRAND}`;
    const body = `${who} invited you to join ${organization} on ${BRAND} as ${role === 'member' ? 'a' : 'an'} ${role}.`;
    const how = 'Log in with this email address, or sign up with it if you\'re new, to accept:';
    const outro = `The invitation expires in ${days} days. If you weren't expecting it, you can ignore this email.`;

    return {
        to,
        subject,
        text: `Hi,\n\n${body}\n\n${how} ${url}\n\n${outro}\n\n${BRAND}`,
        html: layout( {
            subject,
            preheader: body,
            icon: '&#127881;',
            title: 'You\'re invited',
            content: paragraph( 'Hi,' ) + paragraph( escape( body ) ) + paragraph( escape( how ) )
                + button( url, `Join ${organization}` ) + note( escape( outro ), 'info' ),
        } ),
    };
}
