import { expect } from '@playwright/test';

import { MAILPIT_URL } from '../../settings.ts';

interface MessageSummary {
    ID: string;
    Subject: string;
    Created: string;
}

export interface Email {
    Subject: string;
    Text: string;
}

/*
 * The API sends through Mailpit in the UI tests (see playwright.config.ts), so nothing reaches a real inbox; these
 * read what it caught.
 */

/** The newest email to `to` whose subject matches `about`, once it has arrived. */
export async function latestEmail( to: string, about: RegExp, after = new Date( 0 ) ): Promise<Email> {
    let found: MessageSummary | undefined;

    await expect.poll( async () => {
        const query = encodeURIComponent( `to:"${to}"` );
        const response = await fetch( `${MAILPIT_URL}/api/v1/search?query=${query}` );
        const { messages } = ( await response.json() ) as { messages: MessageSummary[] };

        found = messages.find( ( message ) => about.test( message.Subject ) && new Date( message.Created ) >= after );

        return found;
    }, { message: `an email to ${to} matching ${about}` } ).toBeTruthy();

    const response = await fetch( `${MAILPIT_URL}/api/v1/message/${found!.ID}` );

    return ( await response.json() ) as Email;
}

/** The 6-digit code in the newest email to `to` whose subject matches `about`. */
export async function latestCode( to: string, about: RegExp, after = new Date( 0 ) ): Promise<string> {
    const { Subject } = await latestEmail( to, about, after );

    return /^(\d{6})/.exec( Subject )![1];
}
