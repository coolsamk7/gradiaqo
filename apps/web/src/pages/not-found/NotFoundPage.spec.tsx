import { screen } from '@testing-library/react';

import { anonymous, mockApi } from '../../test/api.ts';
import { renderApp } from '../../test/render.tsx';

describe( 'NotFoundPage', () => {
    it( 'is shown for unknown paths, with a way home', () => {
        mockApi( anonymous );

        renderApp( '/nowhere' );

        expect( screen.getByRole( 'heading', { name: 'Page not found' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'link', { name: 'Back to home' } ) ).toHaveAttribute( 'href', '/' );
    } );
} );
