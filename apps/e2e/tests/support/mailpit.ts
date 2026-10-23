import { expect } from '@playwright/test';

import { MAILPIT_URL } from '../../settings.ts';

interface MessageSummary {
    Subject: string;
    Created: string;
}

/**
 * The 6-digit code in the newest email to `to` whose subject matches `about`, once it has arrived. The API sends
 * through Mailpit in the UI tests (see playwright.config.ts), so nothing reaches a real inbox.
 */
export async function latestCode( to: string, about: RegExp, after = new Date( 0 ) ): Promise<string> {
    let code: string | undefined;

    await expect.poll( async () => {
        const query = encodeURIComponent( `to:"${to}"` );
        const response = await fetch( `${MAILPIT_URL}/api/v1/search?query=${query}` );
        const { messages } = ( await response.json() ) as { messages: MessageSummary[] };
        const match = messages.find( ( message ) =>
            about.test( message.Subject ) && new Date( message.Created ) >= after );

        code = match?.Subject.match( /^(\d{6})/ )?.[1];

        return code;
    }, { message: `an email to ${to} matching ${about}` } ).toBeTruthy();

    return code!;
}
