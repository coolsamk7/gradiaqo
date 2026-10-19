import type { PublishedPathSummaryJson } from '@studylog/schemas';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, loggedIn, mockApi, USER } from '../../test/api.ts';
import { catalogPath, uuid } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';

const DSA = catalogPath( 'Data Structures & Algorithms', {
    id: uuid( 301 ),
    description: 'The classic interview patterns.',
    enrollmentId: uuid( 901 ),
    contents: { modules: 4, items: 25, estimatedMinutes: 720 },
} );
const DESIGN = catalogPath( 'System Design', { id: uuid( 302 ), contents: { modules: 1, items: 1, estimatedMinutes: 0 } } );
const MINE = catalogPath( 'My Picks', {
    id: uuid( 303 ),
    organization: { id: uuid( 4 ), name: 'Workspace', isPersonal: true },
    createdBy: { id: USER.id, firstName: 'Sam', lastName: 'Khan' },
} );

/** The API with a logged-in user; `answer` decides what each catalog request returns. */
type Answer = ( query: string ) => PublishedPathSummaryJson[] | Promise<Response>;

function api( answer: Answer = () => [ DSA, DESIGN, MINE ] ) {
    return mockApi( {
        ...loggedIn,
        'GET /catalog/paths': () => {
            const fetchMock = globalThis.fetch as unknown as { mock: { lastCall: [ string ] } };
            const query = new URL( fetchMock.mock.lastCall[0] ).search;
            const result = answer( query );

            return Array.isArray( result ) ? json( 200, result ) : result;
        },
    } );
}

const card = ( title: string ) => screen.getByRole( 'heading', { level: 2, name: title } ).closest( 'li' )!;
const catalogCalls = ( calls: { path: string; query: string }[] ) =>
    calls.filter( ( call ) => call.path === '/catalog/paths' ).map( ( call ) => call.query );

describe( 'CatalogPage', () => {
    it( 'lists the paths with where they come from, what\'s in them and the way in', async () => {
        api();
        renderApp( '/app/catalog' );

        expect( await screen.findByRole( 'heading', { level: 2, name: 'Data Structures & Algorithms' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'link', { name: 'Browse paths' } ) ).toHaveAttribute( 'aria-current', 'page' );

        const dsa = within( card( 'Data Structures & Algorithms' ) );

        expect( dsa.getByText( 'Official' ) ).toBeInTheDocument();
        expect( dsa.getByText( 'Enrolled' ) ).toBeInTheDocument();
        expect( dsa.getByText( 'The classic interview patterns.' ) ).toBeInTheDocument();
        expect( dsa.getByRole( 'list', { name: 'Contents' } ) ).toHaveTextContent( '4 modules25 items≈ 12h' );
        expect( dsa.getByText( 'By StudyLog' ) ).toBeInTheDocument();
        // Enrolled: straight to the path.
        expect( dsa.getByRole( 'link', { name: 'Continue Data Structures & Algorithms' } ) ).toHaveAttribute( 'href', `/app/paths/${uuid( 901 )}` );

        const design = within( card( 'System Design' ) );

        expect( design.queryByText( 'Enrolled' ) ).not.toBeInTheDocument();
        expect( design.getByRole( 'list', { name: 'Contents' } ) ).toHaveTextContent( /^1 module1 item$/ );
        expect( design.getByRole( 'link', { name: 'View System Design' } ) ).toHaveAttribute( 'href', `/app/catalog/${uuid( 302 )}` );
        expect( within( card( 'My Picks' ) ).getByText( 'Yours' ) ).toBeInTheDocument();
    } );

    it( 'filters by where paths come from, kept in the URL', async () => {
        const { calls } = api();
        const user = userEvent.setup();

        renderApp( '/app/catalog' );
        await screen.findByRole( 'heading', { level: 2, name: 'System Design' } );
        expect( screen.getByRole( 'button', { name: 'All' } ) ).toHaveAttribute( 'aria-pressed', 'true' );

        await user.click( screen.getByRole( 'button', { name: 'Community' } ) );
        await waitFor( () => expect( catalogCalls( calls ).at( -1 ) ).toBe( '?source=community' ) );
        expect( screen.getByRole( 'button', { name: 'Community' } ) ).toHaveAttribute( 'aria-pressed', 'true' );
        expect( screen.getByRole( 'button', { name: 'All' } ) ).toHaveAttribute( 'aria-pressed', 'false' );

        await user.click( screen.getByRole( 'button', { name: 'All' } ) );
        await waitFor( () => expect( catalogCalls( calls ).at( -1 ) ).toBe( '' ) );
    } );

    it( 'searches once typing pauses, and says when nothing matches', async () => {
        const { calls } = api( ( query ) => ( query.includes( 'search' ) ? [] : [ DSA ] ) );
        const user = userEvent.setup();

        renderApp( '/app/catalog' );
        await screen.findByRole( 'heading', { level: 2, name: 'Data Structures & Algorithms' } );

        await user.type( screen.getByRole( 'searchbox', { name: 'Search paths' } ), 'graph' );
        expect( await screen.findByRole( 'heading', { name: 'No paths match “graph”' } ) ).toBeInTheDocument();
        // One request for the whole word, not one per letter.
        expect( catalogCalls( calls ) ).toEqual( [ '', '?search=graph' ] );

        await user.clear( screen.getByRole( 'searchbox', { name: 'Search paths' } ) );
        expect( await screen.findByRole( 'heading', { level: 2, name: 'Data Structures & Algorithms' } ) ).toBeInTheDocument();
    } );

    it( 'starts from the filter and search in the URL, ignoring unknown filters', async () => {
        const { calls } = api( () => [] );

        const first = renderApp( '/app/catalog?source=official&q=dsa' );

        expect( await screen.findByRole( 'heading', { name: 'No paths match “dsa”' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'searchbox', { name: 'Search paths' } ) ).toHaveValue( 'dsa' );
        expect( catalogCalls( calls ) ).toEqual( [ '?source=official&search=dsa' ] );
        first.unmount();

        renderApp( '/app/catalog?source=everything' );
        expect( await screen.findByRole( 'heading', { name: 'No paths here yet' } ) ).toBeInTheDocument();
        expect( catalogCalls( calls ).at( -1 ) ).toBe( '' );
    } );

    it( 'when loading fails, says so and can try again', async () => {
        let fail = true;

        api( () => ( fail ? Promise.reject( new TypeError( 'offline' ) ) : [ DSA ] ) );
        renderApp( '/app/catalog' );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach StudyLog right now.' );
        fail = false;
        await userEvent.setup().click( screen.getByRole( 'button', { name: 'Try again' } ) );
        expect( await screen.findByRole( 'heading', { level: 2, name: 'Data Structures & Algorithms' } ) ).toBeInTheDocument();
    } );

    it( 'explains other errors too', async () => {
        api( () => Promise.resolve( json( 500, { statusCode: 500, message: 'boom' } ) ) );
        renderApp( '/app/catalog' );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong while loading the catalog.' );
    } );

    it( 'ignores an answer that comes back after the filter changed', async () => {
        let releaseFirst!: ( response: Response ) => void;
        const user = userEvent.setup();

        api( ( query ) => ( query === ''
            ? new Promise<Response>( ( resolve ) => {
                    releaseFirst = resolve;
                } )
            : [ DESIGN ] ) );
        renderApp( '/app/catalog' );
        await user.click( await screen.findByRole( 'button', { name: 'Official' } ) );
        expect( await screen.findByRole( 'heading', { level: 2, name: 'System Design' } ) ).toBeInTheDocument();

        releaseFirst( json( 200, [ DSA ] ) );
        await new Promise( ( resolve ) => setTimeout( resolve, 20 ) );
        expect( screen.queryByRole( 'heading', { level: 2, name: 'Data Structures & Algorithms' } ) ).not.toBeInTheDocument();
    } );
} );
