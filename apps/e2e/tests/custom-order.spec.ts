import { expect, logIn, test } from './support/fixtures.ts';

const DSA = 'Data Structures & Algorithms';

test.describe( 'Custom order', () => {
    // A new user each time: these tests change the order.
    test( 'orders modules and topics in Path settings, as the path page then shows, and resets', async ( { page, api } ) => {
        const user = await api.signUp();
        const enrollment = await api.enroll( user, DSA );

        await logIn( page, user );
        await page.goto( `/app/paths/${enrollment.id}/settings` );
        const order = page.getByRole( 'region', { name: 'Your order' } );

        await order.getByRole( 'button', { name: 'Move Arrays & Hashing down' } ).click();
        await expect( order.getByRole( 'button', { name: 'Reset to the author\'s order' } ) ).toBeVisible();

        await order.getByRole( 'button', { name: 'Order the topics in Arrays & Hashing' } ).click();
        await order.getByRole( 'list', { name: 'Topics in Arrays & Hashing' } ).getByRole( 'button', { name: 'Move Two Pointers up' } ).click();
        await expect( order.getByRole( 'list', { name: 'Topics in Arrays & Hashing' } ).getByRole( 'listitem' ).first() ).toHaveText( 'Two Pointers' );

        await page.goto( `/app/paths/${enrollment.id}` );
        await expect( page.getByRole( 'heading', { level: 2 } ) ).toHaveText( [ 'Linked Lists', 'Arrays & Hashing', 'Trees', 'Dynamic Programming' ] );
        await expect( page.getByRole( 'region', { name: 'Arrays & Hashing' } ).getByRole( 'heading', { level: 3 } ).first() ).toHaveText( 'Two Pointers' );

        await page.goto( `/app/paths/${enrollment.id}/settings` );
        await order.getByRole( 'button', { name: 'Reset to the author\'s order' } ).click();
        await expect( order.getByRole( 'button', { name: 'Reset to the author\'s order' } ) ).toBeHidden();
        await expect( order.getByRole( 'list', { name: 'Modules' } ).getByRole( 'listitem' ).first() ).toContainText( 'Arrays & Hashing' );
    } );

    test( 'reorders paths on the dashboard', async ( { page, api } ) => {
        const user = await api.signUp();

        await api.enroll( user, DSA );
        await api.enroll( user, 'System Design Fundamentals' );
        await logIn( page, user );

        const paths = page.getByRole( 'region', { name: 'Your learning paths' } );

        await expect( paths.getByRole( 'heading', { level: 3 } ) ).toHaveText( [ DSA, 'System Design Fundamentals' ] );
        await paths.getByRole( 'button', { name: 'Reorder' } ).click();
        await paths.getByRole( 'button', { name: `Move ${DSA} down` } ).click();
        await expect( paths.getByRole( 'heading', { level: 3 } ) ).toHaveText( [ 'System Design Fundamentals', DSA ] );
        await paths.getByRole( 'button', { name: 'Done' } ).click();

        await page.reload();
        await expect( paths.getByRole( 'heading', { level: 3 } ) ).toHaveText( [ 'System Design Fundamentals', DSA ] );
    } );
} );
