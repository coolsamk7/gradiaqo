import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { loggedIn, mockApi, noContent } from '../../test/api.ts';
import { renderApp } from '../../test/render.tsx';

describe( 'AppHomePage', () => {
    it( 'greets the user and logs out to the homepage', async () => {
        const { calls } = mockApi( { ...loggedIn, 'POST /auth/logout': () => noContent() } );

        renderApp( '/app' );
        await userEvent.setup().click( await screen.findByRole( 'button', { name: 'Log out' } ) );

        await waitFor( () => expect( screen.getByTestId( 'location' ) ).toHaveTextContent( /^\/$/ ) );
        expect( screen.getByRole( 'heading', { level: 1 } ) ).toHaveTextContent( 'Study with a plan.' );
        expect( calls.at( -1 ) ).toMatchObject( { path: '/auth/logout' } );
    } );
} );
