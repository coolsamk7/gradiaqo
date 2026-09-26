// Adds DOM matchers like toBeInTheDocument() to expect().
import '@testing-library/jest-dom/vitest';

// Undo fetch mocks (see api.ts) between tests.
afterEach( () => {
    vi.restoreAllMocks();
} );
