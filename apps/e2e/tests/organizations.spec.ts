import type { Page } from '@playwright/test';

import type { TestUser } from './support/api.ts';
import { expect, logIn, test } from './support/fixtures.ts';

/** Logs out, then in as `user`. */
async function switchTo( page: Page, user: TestUser ) {
    await page.getByRole( 'button', { name: 'Log out' } ).click();
    await expect( page ).not.toHaveURL( /\/app/ );
    await logIn( page, user );
}

test.describe( 'Organizations', () => {
    // New users each time: these tests create organizations and change who's in them.
    test( 'an owner creates an organization and invites someone, who accepts and is made an admin', async ( { page, api } ) => {
        const owner = await api.signUp( 'Olive' );
        const friend = await api.signUp( 'Fred' );

        await logIn( page, owner );
        await page.getByRole( 'navigation', { name: 'Main' } ).getByRole( 'link', { name: 'Organizations' } ).click();
        await expect( page.getByRole( 'listitem' ).filter( { hasText: 'Olive\'s Workspace' } ) ).toContainText( 'Personal' );

        await page.getByRole( 'button', { name: 'New organization' } ).click();
        await page.getByLabel( 'Name' ).fill( 'Graph Club' );
        await page.getByRole( 'button', { name: 'Create organization' } ).click();

        await expect( page.getByRole( 'heading', { level: 1, name: 'Graph Club' } ) ).toBeVisible();
        await expect( page.getByText( '1 member · 0 paths · created' ) ).toBeVisible();
        const invite = page.getByRole( 'region', { name: 'Invite someone' } );

        await invite.getByLabel( 'Email' ).fill( friend.email );
        await invite.getByRole( 'button', { name: 'Send invite' } ).click();
        await expect( invite.getByRole( 'status' ) ).toHaveText( `Invitation sent to ${friend.email}.` );
        await expect( page.getByRole( 'region', { name: 'Pending invitations' } ) ).toContainText( `${friend.email}Member · sent today` );
        await expect( page.getByRole( 'tab', { name: 'Invitations · 1' } ) ).toBeVisible();

        // The friend accepts.
        await switchTo( page, friend );
        await page.goto( '/app/organizations' );
        await page.getByRole( 'region', { name: 'Invitations for you' } ).getByRole( 'button', { name: 'Accept' } ).click();
        const card = page.getByRole( 'listitem' ).filter( { hasText: 'Graph Club' } );

        await expect( card ).toContainText( '2 members · 0 pathsMember' );
        await expect( page.getByRole( 'region', { name: 'Invitations for you' } ) ).toBeHidden();
        await card.getByRole( 'link', { name: 'Open Graph Club' } ).click();
        await expect( page.getByRole( 'tab' ) ).toHaveText( [ 'Members', 'Paths' ] );

        // The owner makes them an admin and renames the organization.
        await switchTo( page, owner );
        await page.goto( '/app/organizations' );
        await page.getByRole( 'link', { name: 'Manage Graph Club' } ).click();
        const fred = page.getByRole( 'region', { name: 'Members' } ).getByRole( 'listitem' ).filter( { hasText: 'Fred Tester' } );

        await expect( fred ).toContainText( 'Member' );
        await fred.getByRole( 'button', { name: 'Actions for Fred Tester' } ).click();
        await page.getByRole( 'button', { name: 'Make admin' } ).click();
        await expect( fred ).toContainText( 'Admin' );

        await page.getByRole( 'button', { name: 'Rename' } ).click();
        await page.getByRole( 'dialog' ).getByLabel( 'Name', { exact: true } ).fill( 'Graph & Trees Club' );
        await page.getByRole( 'button', { name: 'Save' } ).click();
        await expect( page.getByRole( 'heading', { level: 1, name: 'Graph & Trees Club' } ) ).toBeVisible();
        await expect( page.getByRole( 'tab', { name: 'Invitations · 0' } ) ).toBeVisible();
    } );

    test( 'the last owner can\'t leave, and deleting needs the name typed', async ( { page, api } ) => {
        const owner = await api.signUp();

        await logIn( page, owner );
        await page.goto( '/app/organizations' );
        await page.getByRole( 'button', { name: 'New organization' } ).click();
        await page.getByLabel( 'Name' ).fill( 'Solo Group' );
        await page.getByRole( 'button', { name: 'Create organization' } ).click();
        await expect( page.getByRole( 'heading', { level: 1, name: 'Solo Group' } ) ).toBeVisible();

        await page.getByRole( 'button', { name: `Actions for ${owner.firstName} ${owner.lastName}` } ).click();
        await page.getByRole( 'button', { name: 'Leave organization' } ).click();
        await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Leave organization' } ).click();
        await expect( page.getByRole( 'alert' ) ).toContainText( 'make someone else owner first' );

        await page.getByRole( 'button', { name: 'Delete', exact: true } ).click();
        const dialog = page.getByRole( 'dialog', { name: 'Delete Solo Group?' } );

        await dialog.getByLabel( 'Type the organization\'s name to confirm' ).fill( 'Solo' );
        await dialog.getByRole( 'button', { name: 'Delete organization' } ).click();
        await expect( dialog ).toContainText( 'Type the name exactly as it is shown.' );
        await dialog.getByLabel( 'Type the organization\'s name to confirm' ).fill( 'Solo Group' );
        await dialog.getByRole( 'button', { name: 'Delete organization' } ).click();

        await expect( page ).toHaveURL( '/app/organizations' );
        await expect( page.getByRole( 'list', { name: 'Your organizations' } ).getByRole( 'listitem' ) ).toHaveCount( 1 );
    } );
} );
