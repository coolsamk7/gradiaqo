import { render } from '@testing-library/react';
import type { InitialEntry } from 'react-router';
import { MemoryRouter, useLocation } from 'react-router';

import { App } from '../App.tsx';

/** Shows the current path, so tests can check where navigation went. */
function LocationProbe() {
    return <div data-testid="location">{useLocation().pathname}</div>;
}

/** The whole app (routes and auth) at a URL. */
export function renderApp( entry: InitialEntry = '/' ) {
    return render(
        <MemoryRouter initialEntries={[ entry ]}>
            <App />
            <LocationProbe />
        </MemoryRouter>,
    );
}
