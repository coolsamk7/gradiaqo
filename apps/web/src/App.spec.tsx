import { screen } from '@testing-library/react';

import { anonymous, mockApi } from './test/api.ts';
import { renderApp } from './test/render.tsx';

describe( 'App', () => {
    it( 'shows the homepage at /', () => {
        mockApi( anonymous );

        renderApp( '/' );

        expect( screen.getByRole( 'heading', { level: 1 } ) ).toHaveTextContent( 'Study with a plan.' );
    } );
} );
