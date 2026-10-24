import type { LearningPathTreeJson } from '@studylog/schemas';
import { CatalogStatus, PathVisibility } from '@studylog/schemas/enums';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, loggedIn, mockApi, noContent, pending, USER } from '../../test/api.ts';
import { catalogItem, pathTree, uuid } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';

const PATH_ID = uuid( 400 );
const URL = `/admin/catalog/paths/${PATH_ID}`;
const ADMIN = { ...USER, platformRole: 'superadmin' };
const DRAFT_ITEM = catalogItem( uuid( 801 ), 'Number of Islands', { status: CatalogStatus.Draft } );

/** A global path: drafts all the way down, except one published topic. */
function graphs( status = CatalogStatus.Draft ): LearningPathTreeJson {
    const tree = pathTree( 'Graph Algorithms', [
        { title: 'Basics', topics: [ { title: 'BFS', items: [ DRAFT_ITEM ] }, { title: 'DFS', items: [] } ] },
    ], { organizationId: null, visibility: PathVisibility.Public, status } );
    const [ module ] = tree.modules;

    return {
        ...tree,
        modules: [ {
            ...module,
            status: CatalogStatus.Draft,
            topics: module.topics.map( ( topic, t ) => (
                { ...topic, status: t === 0 ? CatalogStatus.Draft : CatalogStatus.Published }
            ) ),
        } ],
    };
}

type Handler = ( init: RequestInit ) => Response | Promise<Response>;

function api( handlers: Record<string, Handler> = {}, tree = graphs() ) {
    const server = { tree };
    const { calls } = mockApi( {
        ...loggedIn,
        'GET /auth/me': () => json( 200, ADMIN ),
        [`GET ${URL}`]: () => json( 200, server.tree ),
        ...handlers,
    } );

    return { server, calls };
}

describe( 'Building a global path', () => {
    it( 'shows the path\'s status, what isn\'t published yet, and the way back', async () => {
        const { calls } = api();

        renderApp( `/app/admin/catalog/paths/${PATH_ID}` );

        expect( await screen.findByRole( 'heading', { level: 1, name: 'Graph Algorithms' } ) ).toBeInTheDocument();
        expect( screen.getByText( 'Draft', { selector: 'h1 + span' } ) ).toBeInTheDocument();
        expect( screen.getByText( 'Global catalog · a draft: learners see it once it\'s published' ) ).toBeInTheDocument();
        expect( screen.getByRole( 'link', { name: 'Back to the global catalog' } ) ).toHaveAttribute( 'href', '/app/admin/catalog' );
        expect( screen.queryByRole( 'switch', { name: 'Public' } ) ).not.toBeInTheDocument();
        // No organization to load in the global catalog.
        expect( calls.some( ( call ) => call.path.startsWith( '/organizations' ) ) ).toBe( false );

        const tree = within( screen.getByRole( 'list', { name: 'Modules' } ) );

        expect( tree.getByRole( 'button', { name: 'BasicsDraft' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'list', { name: 'Topics in Basics' } ) ).toHaveTextContent( 'BFSDraft1DFS0' );
        expect( within( screen.getByRole( 'list', { name: 'Items in BFS' } ) ).getByText( 'Number of Islands' ) ).toHaveTextContent( 'Number of IslandsDraft' );
    } );

    it( 'publishes the path, and changes a part\'s status from the editor', async () => {
        let answer = () => json( 500, {} );
        const { server, calls } = api( {
            [`PATCH ${URL}`]: ( init ) => {
                const { status } = JSON.parse( init.body as string ) as { status: CatalogStatus };

                server.tree = { ...server.tree, status };

                return json( 200, server.tree );
            },
            [`PATCH /admin/catalog/modules/${uuid( 500 )}`]: () => answer(),
        } );
        const user = userEvent.setup();

        renderApp( `/app/admin/catalog/paths/${PATH_ID}` );
        await user.click( await screen.findByRole( 'button', { name: 'Publish' } ) );

        expect( await screen.findByText( 'Global catalog · changes are live for everyone who follows this path' ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'button', { name: 'Publish' } ) ).not.toBeInTheDocument();
        // Published content can't be deleted.
        expect( screen.queryByRole( 'button', { name: 'Delete path' } ) ).not.toBeInTheDocument();

        await user.click( screen.getByRole( 'button', { name: 'BasicsDraft' } ) );
        const status = screen.getByLabelText( 'Status' );

        expect( status ).toHaveValue( 'draft' );
        expect( status ).toHaveAccessibleDescription( 'Learners only see published parts.' );
        await user.selectOptions( status, 'Published' );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong' );

        answer = () => json( 200, {} );
        await user.selectOptions( status, 'Published' );
        await waitFor( () => expect( calls.filter( ( call ) => call.path === `/admin/catalog/modules/${uuid( 500 )}` ) ).toHaveLength( 2 ) );
        expect( calls.filter( ( call ) => call.method === 'PATCH' ).at( -1 )?.body ).toEqual( { status: 'published' } );
    } );

    it( 'says when an archived path is out of the catalog', async () => {
        api( {}, graphs( CatalogStatus.Archived ) );
        renderApp( `/app/admin/catalog/paths/${PATH_ID}` );

        expect( await screen.findByText( 'Global catalog · archived: it\'s out of the catalog, and its followers keep it' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Archived', { selector: 'h1 + span' } ) ).toBeInTheDocument();
    } );

    it( 'deletes a draft path, then goes back to the catalog', async () => {
        const { calls } = api( { [`DELETE ${URL}`]: () => noContent(), 'GET /admin/catalog/paths': pending, 'GET /admin/reports': pending } );
        const user = userEvent.setup();

        renderApp( `/app/admin/catalog/paths/${PATH_ID}` );
        await user.click( await screen.findByRole( 'button', { name: 'Delete path' } ) );
        await user.click( within( screen.getByRole( 'group', { name: 'Delete this path?' } ) ).getByRole( 'button', { name: 'Delete' } ) );

        await waitFor( () => expect( screen.getByTestId( 'location' ) ).toHaveTextContent( /^\/app\/admin\/catalog$/ ) );
        expect( calls.some( ( call ) => call.method === 'DELETE' && call.path === URL ) ).toBe( true );
    } );
} );
