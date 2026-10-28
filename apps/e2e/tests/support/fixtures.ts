import type { Page } from '@playwright/test';
import { expect, test as base } from '@playwright/test';

import { API_URL, PASSWORD } from '../../settings.ts';
import type { TestUser } from './api.ts';
import { Api } from './api.ts';

/** The dummy users from `yarn cli db:seed`. Tests only read their data; tests that change data use a new user. */
export const SEEDED = {
    alice: 'alice@example.com',
    bob: 'bob@example.com',
    carol: 'carol@example.com',
    dave: 'dave@example.com',
} as const;

export const test = base.extend<{ api: Api }>( {
    api: async ( { playwright }, use ) => {
        const context = await playwright.request.newContext( { baseURL: API_URL } );

        await use( new Api( context ) );
        await context.dispose();
    },
} );

export { expect };

/** Logs in through the login page and waits for the dashboard. */
export async function logIn( page: Page, user: string | TestUser ) {
    const { email, password } = typeof user === 'string' ? { email: user, password: PASSWORD } : user;

    await page.goto( '/login' );
    await page.getByLabel( 'Email' ).fill( email );
    await page.getByLabel( 'Password', { exact: true } ).fill( password );
    await page.getByRole( 'button', { name: 'Log in' } ).click();
    await expect( page ).toHaveURL( '/app' );
}

/** Makes every API call matching `path` (e.g. `/me/stats*`) fail as if the network were down, until undone. */
export async function failRequests( page: Page, path: string, method?: string ): Promise<() => Promise<void>> {
    const url = `${API_URL}${path}`;

    await page.route( url, ( route ) =>
        ( !method || route.request().method() === method ? route.abort() : route.fallback() ) );

    return () => page.unroute( url );
}

export const OFFLINE = 'Can\'t reach Gradiaqo right now. Check your connection and try again.';
