import type { ManagedItemJson, ManagedLearningPathJson } from '@studylog/schemas';
import { CatalogStatus, Difficulty, ItemType, PathVisibility } from '@studylog/schemas/enums';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, loggedIn, mockApi, noContent, pending, USER } from '../../test/api.ts';
import { catalogItem, uuid } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';

type Handlers = Parameters<typeof mockApi>[0];

const ADMIN = { ...USER, platformRole: 'superadmin' };
const TODAY = new Date().toISOString();

type PathOverrides = Partial<ManagedLearningPathJson>;

const path = ( n: number, title: string, status: CatalogStatus, overrides: PathOverrides = {} ) => ( {
    id: uuid( 400 + n ),
    title,
    slug: title.toLowerCase().replace( /\W+/g, '-' ),
    description: null,
    position: n,
    status,
    organizationId: null,
    visibility: PathVisibility.Public,
    publicBlockedAt: null,
    createdAt: '2026-09-02T09:00:00.000Z',
    updatedAt: '2026-10-02T09:00:00.000Z',
    moduleCount: 4,
    itemCount: 25,
    ...overrides,
} );

const DSA = path( 1, 'Data Structures & Algorithms', CatalogStatus.Published );
const GRAPHS = path( 2, 'Graph Algorithms', CatalogStatus.Draft, { moduleCount: 1, itemCount: 1, updatedAt: TODAY } );
const ARRAYS = path( 3, 'Arrays Crash Course', CatalogStatus.Archived, { moduleCount: 2, itemCount: 10 } );

const item = ( id: number, title: string, overrides: Partial<ManagedItemJson> = {} ): ManagedItemJson => ( {
    ...catalogItem( uuid( id ), title ),
    updatedAt: '2026-09-25T09:00:00.000Z',
    topicCount: 4,
    ...overrides,
} );

const TWO_SUM = item( 801, 'Two Sum', {
    difficulty: Difficulty.Easy,
    estimatedMinutes: 15,
    details: { url: 'https://leetcode.com/problems/two-sum', platform: 'leetcode' },
} );
const ISLANDS = item( 802, 'Number of Islands', { status: CatalogStatus.Draft, topicCount: 1, updatedAt: TODAY } );
const QUIZ = item( 803, 'Old Arrays Quiz', { type: ItemType.Exercise, status: CatalogStatus.Archived, topicCount: 0, details: { instructions: 'Answer them' } } );

function api( handlers: Handlers = {} ) {
    return mockApi( {
        ...loggedIn,
        'GET /auth/me': () => json( 200, ADMIN ),
        'GET /admin/reports': () => json( 200, { items: [], total: 1 } ),
        'GET /admin/catalog/paths': () => json( 200, [ DSA, GRAPHS, ARRAYS ] ),
        'GET /admin/catalog/items': () => json( 200, { items: [ TWO_SUM, ISLANDS, QUIZ ], total: 3 } ),
        ...handlers,
    } );
}

const rows = ( name: string ) => within( screen.getByRole( 'region', { name } ) ).getAllByRole( 'row' ).slice( 1 );
const row = ( name: string, title: string ) => rows( name ).find( ( r ) => r.textContent?.startsWith( title ) )!;

describe( 'The global catalog', () => {
    it( 'lists the official paths with their status and size, and opens one in the builder', async () => {
        api();
        renderApp( '/app/admin/catalog' );

        expect( await screen.findByRole( 'heading', { level: 1, name: 'Global catalog' } ) ).toBeInTheDocument();
        await screen.findByRole( 'region', { name: 'Paths' } );

        expect( rows( 'Paths' ).map( ( r ) => r.textContent ) ).toEqual( [
            'Data Structures & AlgorithmsPublished425Oct 2Edit',
            'Graph AlgorithmsDraft11TodayEdit',
            'Arrays Crash CourseArchived210Oct 2Edit',
        ] );
        expect( within( row( 'Paths', 'Graph' ) ).getByRole( 'link', { name: 'Edit Graph Algorithms' } ) )
            .toHaveAttribute( 'href', `/app/admin/catalog/paths/${GRAPHS.id}` );
        expect( screen.getByRole( 'link', { name: 'Reports · 1' } ) ).toHaveAttribute( 'href', '/app/admin/reports' );
        expect( screen.getByRole( 'button', { name: 'Paths' } ) ).toHaveAttribute( 'aria-pressed', 'true' );
    } );

    it( 'filters the paths by title and status', async () => {
        api();
        const user = userEvent.setup();

        renderApp( '/app/admin/catalog' );
        await screen.findByRole( 'region', { name: 'Paths' } );

        await user.type( screen.getByRole( 'searchbox', { name: 'Search paths' } ), 'algo' );
        expect( rows( 'Paths' ) ).toHaveLength( 2 );
        await user.selectOptions( screen.getByRole( 'combobox', { name: 'Status' } ), 'Draft' );
        expect( rows( 'Paths' ).map( ( r ) => r.textContent?.slice( 0, 16 ) ) ).toEqual( [ 'Graph Algorithms' ] );
        await user.type( screen.getByRole( 'searchbox', { name: 'Search paths' } ), 'zzz' );
        expect( screen.getByRole( 'region', { name: 'Paths' } ) ).toHaveTextContent( 'No paths match.' );
    } );

    it( 'publishes, archives, moves to draft and deletes paths from their menu', async () => {
        let answer = () => json( 409, { statusCode: 409, message: 'Only drafts can be deleted' } );
        const { calls } = api( {
            [`PATCH /admin/catalog/paths/${GRAPHS.id}`]: () => json( 200, GRAPHS ),
            [`PATCH /admin/catalog/paths/${DSA.id}`]: () => json( 200, DSA ),
            [`DELETE /admin/catalog/paths/${GRAPHS.id}`]: () => answer(),
        } );
        const user = userEvent.setup();
        const choose = async ( title: string, action: string ) => {
            await user.click( within( row( 'Paths', title ) ).getByRole( 'button', { name: `More for ${title}` } ) );
            await user.click( screen.getByRole( 'button', { name: action } ) );
        };

        renderApp( '/app/admin/catalog' );
        await screen.findByRole( 'region', { name: 'Paths' } );

        await user.click( within( row( 'Paths', 'Graph Algorithms' ) ).getByRole( 'button', { name: 'More for Graph Algorithms' } ) );
        expect( screen.getAllByRole( 'button', { name: /^(Publish|Move to draft|Archive|Delete)$/ } ).map( ( b ) => b.textContent ) )
            .toEqual( [ 'Publish', 'Archive', 'Delete' ] );
        await user.click( screen.getByRole( 'button', { name: 'Publish' } ) );
        await waitFor( () => expect( calls.filter( ( call ) => call.method === 'PATCH' ).at( -1 )?.body ).toEqual( { status: 'published' } ) );

        await choose( 'Data Structures & Algorithms', 'Move to draft' );
        await waitFor( () => expect( calls.filter( ( call ) => call.method === 'PATCH' ).at( -1 )?.body ).toEqual( { status: 'draft' } ) );
        await choose( 'Data Structures & Algorithms', 'Archive' );
        await waitFor( () => expect( calls.filter( ( call ) => call.method === 'PATCH' ).at( -1 )?.body ).toEqual( { status: 'archived' } ) );

        await choose( 'Graph Algorithms', 'Delete' );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Only drafts can be deleted.' );

        answer = () => noContent();
        await choose( 'Graph Algorithms', 'Delete' );
        await waitFor( () => expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument() );
        expect( calls.filter( ( call ) => call.path === '/admin/catalog/paths' ).length ).toBeGreaterThan( 4 );
    } );

    it( 'creates a path as a draft, then opens it', async () => {
        let answer = () => json( 409, { statusCode: 409, message: 'Slug already used by another path' } );
        const { calls } = api( {
            'POST /admin/catalog/paths': () => answer(),
            [`GET /admin/catalog/paths/${GRAPHS.id}`]: pending,
        } );
        const user = userEvent.setup();

        renderApp( '/app/admin/catalog' );
        await user.click( await screen.findByRole( 'button', { name: 'New path' } ) );

        const dialog = within( screen.getByRole( 'dialog', { name: 'New path' } ) );

        expect( dialog.getByLabelText( 'Title' ) ).toHaveFocus();
        await user.click( dialog.getByRole( 'button', { name: 'Create path' } ) );
        expect( dialog.getByLabelText( 'Title' ) ).toHaveAccessibleDescription( 'Enter a title.' );

        await user.type( dialog.getByLabelText( 'Title' ), ' Graph Algorithms ' );
        await user.type( dialog.getByLabelText( 'Description (optional)' ), 'BFS, DFS and friends.' );
        await user.click( dialog.getByRole( 'button', { name: 'Create path' } ) );
        expect( await dialog.findByRole( 'alert' ) ).toHaveTextContent( 'Slug already used by another path.' );

        answer = () => json( 201, GRAPHS );
        await user.click( dialog.getByRole( 'button', { name: 'Create path' } ) );

        await waitFor( () => expect( screen.getByTestId( 'location' ) ).toHaveTextContent( `/app/admin/catalog/paths/${GRAPHS.id}` ) );
        expect( calls.filter( ( call ) => call.path === '/admin/catalog/paths' && call.method === 'POST' ).at( -1 )?.body )
            .toEqual( { title: 'Graph Algorithms', description: 'BFS, DFS and friends.' } );
    } );

    it( 'closes the new path dialog without creating one, and waits while creating', async () => {
        const { calls } = api( { 'POST /admin/catalog/paths': pending } );
        const user = userEvent.setup();

        renderApp( '/app/admin/catalog' );
        await user.click( await screen.findByRole( 'button', { name: 'New path' } ) );
        await user.type( screen.getByLabelText( 'Title' ), 'Trees' );
        await user.click( screen.getByRole( 'button', { name: 'Create path' } ) );
        expect( screen.getByRole( 'button', { name: 'Creating…' } ) ).toBeDisabled();
        await user.click( screen.getByRole( 'button', { name: 'Cancel' } ) );

        expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
        expect( calls.find( ( call ) => call.path === '/admin/catalog/paths' && call.method === 'POST' )?.body ).toEqual( { title: 'Trees' } );
    } );

    it( 'says when there are no paths, while loading, and when loading failed', async () => {
        let answer: () => Response | Promise<Response> = pending;

        api( { 'GET /admin/catalog/paths': () => answer(), 'GET /admin/reports': pending } );
        const first = renderApp( '/app/admin/catalog' );

        expect( await screen.findByText( 'Loading the paths…' ) ).toBeInTheDocument();
        expect( screen.getByRole( 'link', { name: 'Reports' } ) ).toBeInTheDocument();
        first.unmount();

        answer = () => json( 500, {} );
        renderApp( '/app/admin/catalog' );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong while loading.' );

        answer = () => Promise.reject( new TypeError( 'Failed to fetch' ) );
        await userEvent.setup().click( screen.getByRole( 'button', { name: 'Try again' } ) );
        await waitFor( () => expect( screen.getByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach Gradiaqo right now.' ) );

        answer = () => json( 200, [] );
        await userEvent.setup().click( screen.getByRole( 'button', { name: 'Try again' } ) );
        expect( await screen.findByText( 'No official paths yet.' ) ).toBeInTheDocument();
    } );

    describe( 'Importing a path file', () => {
        const preview = ( overrides: Record<string, unknown> = {} ) => ( {
            dryRun: true,
            path: { id: GRAPHS.id, slug: 'graph-algorithms', title: 'Graph Algorithms', status: CatalogStatus.Draft, created: true, updated: false },
            modules: { total: 2, created: 2, updated: 0 },
            topics: { total: 5, created: 5, updated: 0 },
            items: { total: 12, created: 11, updated: 1, linked: 12, unlinked: 0 },
            notInFile: [],
            unpublishedItems: [],
            ...overrides,
        } );
        const yaml = ( name: string, text = 'slug: graph-algorithms\n' ) => new File( [ text ], name, { type: 'application/yaml' } );
        const sent = ( calls: { method: string; path: string; body?: unknown }[] ) =>
            calls.filter( ( call ) => call.method === 'POST' && call.path === '/admin/catalog/import' ).map( ( call ) => call.body );
        const pathLoads = ( calls: { method: string; path: string }[] ) =>
            calls.filter( ( call ) => call.method === 'GET' && call.path === '/admin/catalog/paths' ).length;

        it( 'shows what the file would change, imports it, and reloads the paths', async () => {
            const { calls } = api( {
                'POST /admin/catalog/import': ( init ) => {
                    const { dryRun } = JSON.parse( init?.body as string ) as { dryRun?: boolean };

                    return json( 200, preview( {
                        dryRun: dryRun ?? false,
                        notInFile: [ 'module "Old"' ],
                        unpublishedItems: [ '"Dijkstra" (draft)' ],
                    } ) );
                },
            } );
            const user = userEvent.setup();

            renderApp( '/app/admin/catalog' );
            await user.click( await screen.findByRole( 'button', { name: 'Import file' } ) );

            const dialog = within( screen.getByRole( 'dialog', { name: 'Import a path' } ) );

            expect( dialog.getByLabelText( 'Path file' ) ).toHaveFocus();
            expect( dialog.getByRole( 'button', { name: 'Import' } ) ).toBeDisabled();
            await user.upload( dialog.getByLabelText( 'Path file' ), yaml( 'graphs.yaml' ) );

            const changes = within( await dialog.findByRole( 'region', { name: 'What importing changes' } ) );

            expect( changes.getByText( 'Graph Algorithms' ).parentElement ).toHaveTextContent( 'Graph Algorithms (graph-algorithms) · New path, a draft' );
            expect( changes.getAllByRole( 'listitem' ).map( ( line ) => line.textContent ) ).toEqual( [
                '2 modules: 2 new, 0 changed',
                '5 topics: 5 new, 0 changed',
                '12 items: 11 new, 1 changed · 12 added to topics, 0 taken out',
            ] );
            expect( changes.getByText( 'Not in the file, kept: module "Old". Delete it in the path if you mean to.' ) ).toBeInTheDocument();
            expect( changes.getByText( 'Not published, so learners don\'t see it: "Dijkstra" (draft).' ) ).toBeInTheDocument();
            expect( sent( calls ) ).toEqual( [ { content: 'slug: graph-algorithms\n', dryRun: true } ] );
            expect( pathLoads( calls ) ).toBe( 1 );

            await user.click( dialog.getByRole( 'button', { name: 'Import' } ) );

            expect( await dialog.findByRole( 'status' ) ).toHaveTextContent(
                'Imported “Graph Algorithms”. It\'s a draft: publish it when it\'s ready, and learners will see it.',
            );
            expect( sent( calls ).at( -1 ) ).toEqual( { content: 'slug: graph-algorithms\n' } );
            expect( dialog.getByRole( 'link', { name: 'Open path' } ) ).toHaveAttribute( 'href', `/app/admin/catalog/paths/${GRAPHS.id}` );

            await user.click( dialog.getByRole( 'button', { name: 'Done' } ) );
            expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
            await waitFor( () => expect( pathLoads( calls ) ).toBe( 2 ) );
        } );

        it( 'lists the file\'s problems, and says when the catalog already matches the file', async () => {
            let answer = () => json( 400, {
                statusCode: 400,
                message: 'The file doesn\'t match the format:\n  /slug: must match pattern\n  /modules: must not have fewer than 1 items',
            } );

            api( { 'POST /admin/catalog/import': () => answer() } );
            const user = userEvent.setup();

            renderApp( '/app/admin/catalog' );
            await user.click( await screen.findByRole( 'button', { name: 'Import file' } ) );
            await user.upload( screen.getByLabelText( 'Path file' ), yaml( 'broken.yaml' ) );

            const alert = await screen.findByRole( 'alert' );

            expect( alert ).toHaveTextContent( /^The file doesn't match the format:/ );
            expect( within( alert ).getAllByRole( 'listitem' ).map( ( line ) => line.textContent ) )
                .toEqual( [ '/slug: must match pattern', '/modules: must not have fewer than 1 items' ] );
            expect( screen.getByRole( 'button', { name: 'Import' } ) ).toBeDisabled();

            answer = () => json( 200, preview( {
                path: { ...preview().path, created: false, status: CatalogStatus.Published },
                modules: { total: 2, created: 0, updated: 0 },
                topics: { total: 5, created: 0, updated: 0 },
                items: { total: 12, created: 0, updated: 0, linked: 0, unlinked: 0 },
            } ) );
            await user.upload( screen.getByLabelText( 'Path file' ), yaml( 'graphs.yaml' ) );

            expect( await screen.findByText( 'Nothing to import: the catalog already matches this file.' ) ).toBeInTheDocument();
            expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();
            expect( screen.getByText( /Already there, published/ ) ).toBeInTheDocument();
            expect( screen.getByRole( 'button', { name: 'Import' } ) ).toBeDisabled();
        } );

        it( 'refuses an empty file without asking the API, and closes without reloading', async () => {
            const { calls } = api();
            const user = userEvent.setup();

            renderApp( '/app/admin/catalog' );
            await user.click( await screen.findByRole( 'button', { name: 'Import file' } ) );
            await user.upload( screen.getByLabelText( 'Path file' ), yaml( 'empty.yaml', '\n' ) );

            expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'The file is empty.' );
            expect( sent( calls ) ).toEqual( [] );

            await user.click( screen.getByRole( 'button', { name: 'Cancel' } ) );
            expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
            expect( pathLoads( calls ) ).toBe( 1 );
        } );

        it( 'waits while checking and importing, and says when importing failed', async () => {
            let answer: () => Response | Promise<Response> = pending;

            api( { 'POST /admin/catalog/import': () => answer() } );
            const user = userEvent.setup();

            renderApp( '/app/admin/catalog' );
            await user.click( await screen.findByRole( 'button', { name: 'Import file' } ) );
            await user.upload( screen.getByLabelText( 'Path file' ), yaml( 'graphs.yaml' ) );
            expect( await screen.findByRole( 'status' ) ).toHaveTextContent( 'Checking graphs.yaml…' );
            expect( screen.getByRole( 'button', { name: 'Import' } ) ).toBeDisabled();

            // A second file replaces the first, whose answer no longer matters.
            answer = () => json( 200, preview() );
            await user.upload( screen.getByLabelText( 'Path file' ), yaml( 'graphs-2.yaml' ) );
            await screen.findByRole( 'region', { name: 'What importing changes' } );
            expect( screen.queryByRole( 'status' ) ).not.toBeInTheDocument();

            answer = pending;
            await user.click( screen.getByRole( 'button', { name: 'Import' } ) );
            expect( screen.getByRole( 'button', { name: 'Importing…' } ) ).toBeDisabled();

            await user.click( screen.getByRole( 'button', { name: 'Cancel' } ) );
            await user.click( screen.getByRole( 'button', { name: 'Import file' } ) );
            answer = () => json( 200, preview() );
            await user.upload( screen.getByLabelText( 'Path file' ), yaml( 'graphs.yaml' ) );
            await screen.findByRole( 'region', { name: 'What importing changes' } );
            answer = () => json( 500, {} );
            await user.click( screen.getByRole( 'button', { name: 'Import' } ) );
            expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so nothing changed. Please try again.' );
            expect( screen.getByRole( 'button', { name: 'Import' } ) ).toBeEnabled();
        } );

        it( 'ignores a check that ends after another file was chosen, and clears when the file is removed', async () => {
            const answers: ( ( response: Response ) => void )[] = [];

            api( { 'POST /admin/catalog/import': () => new Promise<Response>( ( resolve ) => answers.push( resolve ) ) } );
            const user = userEvent.setup();
            const titled = ( title: string ) => preview( { path: { ...preview().path, title } } );

            renderApp( '/app/admin/catalog' );
            await user.click( await screen.findByRole( 'button', { name: 'Import file' } ) );
            await user.upload( screen.getByLabelText( 'Path file' ), yaml( 'old.yaml' ) );
            await user.upload( screen.getByLabelText( 'Path file' ), yaml( 'new.yaml' ) );
            await waitFor( () => expect( answers ).toHaveLength( 2 ) );

            await act( () => Promise.resolve( answers[1]( json( 200, titled( 'New' ) ) ) ) );
            await act( () => Promise.resolve( answers[0]( json( 200, titled( 'Old' ) ) ) ) );
            expect( screen.getByText( 'New' ) ).toBeInTheDocument();
            expect( screen.queryByText( 'Old' ) ).not.toBeInTheDocument();

            // A failure that comes too late is ignored too.
            await user.upload( screen.getByLabelText( 'Path file' ), yaml( 'broken.yaml' ) );
            await user.upload( screen.getByLabelText( 'Path file' ), yaml( 'fixed.yaml' ) );
            await waitFor( () => expect( answers ).toHaveLength( 4 ) );
            await act( () => Promise.resolve( answers[3]( json( 200, titled( 'Fixed' ) ) ) ) );
            await act( () => Promise.resolve( answers[2]( json( 400, { statusCode: 400, message: 'Not valid YAML: oops' } ) ) ) );
            expect( screen.getByText( 'Fixed' ) ).toBeInTheDocument();
            expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();

            await user.upload( screen.getByLabelText( 'Path file' ), [] );
            expect( screen.queryByRole( 'region', { name: 'What importing changes' } ) ).not.toBeInTheDocument();
            expect( screen.getByRole( 'button', { name: 'Import' } ) ).toBeDisabled();
        } );

        it( 'is only offered for paths, and works while the paths are loading or failed to load', async () => {
            let answer: () => Response | Promise<Response> = pending;

            api( { 'GET /admin/catalog/paths': () => answer() } );
            const user = userEvent.setup();

            renderApp( '/app/admin/catalog?tab=items' );
            await screen.findByRole( 'button', { name: 'New item' } );
            expect( screen.queryByRole( 'button', { name: 'Import file' } ) ).not.toBeInTheDocument();

            await user.click( screen.getByRole( 'button', { name: 'Paths' } ) );
            await user.click( screen.getByRole( 'button', { name: 'Import file' } ) );
            expect( screen.getByRole( 'dialog', { name: 'Import a path' } ) ).toBeInTheDocument();
            await user.click( screen.getByRole( 'button', { name: 'Cancel' } ) );

            answer = () => json( 500, {} );
            await user.click( screen.getByRole( 'button', { name: 'Items' } ) );
            await user.click( screen.getByRole( 'button', { name: 'Paths' } ) );
            await screen.findByText( /Something went wrong while loading/ );
            await user.click( screen.getByRole( 'button', { name: 'Import file' } ) );
            expect( screen.getByRole( 'dialog', { name: 'Import a path' } ) ).toBeInTheDocument();
        } );
    } );

    describe( 'Items', () => {
        it( 'lists the official items with their type, status and use', async () => {
            const { calls } = api();

            renderApp( '/app/admin/catalog?tab=items' );
            await screen.findByRole( 'region', { name: 'Items' } );

            expect( screen.getByRole( 'button', { name: 'Items' } ) ).toHaveAttribute( 'aria-pressed', 'true' );
            expect( screen.getByRole( 'button', { name: 'New item' } ) ).toBeInTheDocument();
            expect( rows( 'Items' ).map( ( r ) => r.textContent ) ).toEqual( [
                'Two SumProblemPublished4 topicsSep 25Edit',
                'Number of IslandsProblemDraft1 topicTodayEdit',
                'Old Arrays QuizExerciseArchived—Sep 25Edit',
            ] );
            expect( calls.find( ( call ) => call.path === '/admin/catalog/items' )?.query ).toBe( '' );
        } );

        it( 'searches by title (once typing stops) and filters by type', async () => {
            vi.useFakeTimers( { shouldAdvanceTime: true } );
            try {
                const { calls } = api( { 'GET /admin/catalog/items': () => json( 200, { items: [ TWO_SUM ], total: 120 } ) } );
                const user = userEvent.setup( { advanceTimers: vi.advanceTimersByTime } );

                renderApp( '/app/admin/catalog?tab=items' );
                await user.type( await screen.findByRole( 'searchbox', { name: 'Search items' } ), ' two ' );
                await act( () => vi.advanceTimersByTimeAsync( 300 ) );
                await user.selectOptions( screen.getByRole( 'combobox', { name: 'Type' } ), 'Problem' );

                await waitFor( () => expect( calls.filter( ( call ) => call.path === '/admin/catalog/items' ).at( -1 )?.query )
                    .toBe( '?search=two&type=problem' ) );
                expect( calls.filter( ( call ) => call.path === '/admin/catalog/items' ).map( ( call ) => call.query ) )
                    .toEqual( [ '', '?search=two', '?search=two&type=problem' ] );
                expect( await screen.findByText( 'Showing 1 of 120. Search to find the others.' ) ).toBeInTheDocument();
            } finally {
                vi.useRealTimers();
            }
        } );

        it( 'creates an item as a draft', async () => {
            let answer = () => json( 400, { statusCode: 400, message: 'Bad Request', errors: [ { path: '/details/url', message: 'must be a link' } ] } );
            const { calls } = api( { 'POST /admin/catalog/items': () => answer() } );
            const user = userEvent.setup();

            renderApp( '/app/admin/catalog?tab=items' );
            await user.click( await screen.findByRole( 'button', { name: 'New item' } ) );

            const dialog = within( screen.getByRole( 'dialog', { name: 'New item' } ) );

            expect( dialog.getByLabelText( 'Title' ) ).toHaveFocus();
            await user.click( dialog.getByRole( 'button', { name: 'Create item' } ) );
            expect( dialog.getByLabelText( 'Title' ) ).toHaveAccessibleDescription( 'Enter a title.' );

            await user.type( dialog.getByLabelText( 'Title' ), 'Course Schedule' );
            await user.type( dialog.getByLabelText( 'Link' ), 'https://leetcode.com/problems/course-schedule' );
            await user.click( dialog.getByRole( 'button', { name: 'Create item' } ) );
            await waitFor( () => expect( dialog.getByLabelText( 'Link' ) ).toHaveAccessibleDescription( 'Link must be a link.' ) );

            answer = () => json( 500, {} );
            await user.click( dialog.getByRole( 'button', { name: 'Create item' } ) );
            expect( await dialog.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so nothing changed.' );

            answer = () => Promise.reject( new TypeError( 'Failed to fetch' ) ) as never;
            await user.click( dialog.getByRole( 'button', { name: 'Create item' } ) );
            await waitFor( () => expect( dialog.getByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach Gradiaqo right now.' ) );

            answer = () => json( 201, ISLANDS );
            await user.click( dialog.getByRole( 'button', { name: 'Create item' } ) );

            await waitFor( () => expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument() );
            expect( calls.filter( ( call ) => call.path === '/admin/catalog/items' && call.method === 'POST' ).at( -1 )?.body ).toEqual( {
                type: 'problem',
                title: 'Course Schedule',
                details: { url: 'https://leetcode.com/problems/course-schedule', platform: 'leetcode' },
            } );
        } );

        it( 'edits an item, keeping its type, and clears what was emptied', async () => {
            const { calls } = api( { [`PATCH /admin/catalog/items/${TWO_SUM.id}`]: () => json( 200, TWO_SUM ) } );
            const user = userEvent.setup();

            renderApp( '/app/admin/catalog?tab=items' );
            await screen.findByRole( 'region', { name: 'Items' } );
            await user.click( within( row( 'Items', 'Two Sum' ) ).getByRole( 'button', { name: 'Edit Two Sum' } ) );

            const dialog = within( screen.getByRole( 'dialog', { name: 'Edit item' } ) );

            expect( dialog.getByLabelText( 'Type' ) ).toBeDisabled();
            expect( dialog.getByLabelText( 'Title' ) ).toHaveValue( 'Two Sum' );
            expect( dialog.getByLabelText( 'Difficulty' ) ).toHaveValue( 'easy' );
            expect( dialog.getByLabelText( 'Minutes (optional)' ) ).toHaveValue( '15' );
            await user.clear( dialog.getByLabelText( 'Minutes (optional)' ) );
            await user.selectOptions( dialog.getByLabelText( 'Difficulty' ), 'Not set' );
            await user.click( dialog.getByRole( 'button', { name: 'Save changes' } ) );

            await waitFor( () => expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument() );
            expect( calls.find( ( call ) => call.method === 'PATCH' )?.body ).toEqual( {
                title: 'Two Sum',
                details: TWO_SUM.details,
                difficulty: null,
                estimatedMinutes: null,
            } );

            await user.click( within( row( 'Items', 'Old Arrays Quiz' ) ).getByRole( 'button', { name: 'Edit Old Arrays Quiz' } ) );
            expect( screen.getByLabelText( 'Instructions' ) ).toHaveValue( 'Answer them' );
            await user.click( screen.getByRole( 'button', { name: 'Cancel' } ) );
            expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
        } );

        it( 'changes an item\'s status and deletes drafts', async () => {
            const { calls } = api( {
                [`PATCH /admin/catalog/items/${ISLANDS.id}`]: () => json( 200, ISLANDS ),
                [`DELETE /admin/catalog/items/${ISLANDS.id}`]: () => json( 500, {} ),
            } );
            const user = userEvent.setup();

            renderApp( '/app/admin/catalog?tab=items' );
            await screen.findByRole( 'region', { name: 'Items' } );
            await user.click( within( row( 'Items', 'Number of Islands' ) ).getByRole( 'button', { name: 'More for Number of Islands' } ) );
            await user.click( screen.getByRole( 'button', { name: 'Publish' } ) );
            await waitFor( () => expect( calls.find( ( call ) => call.method === 'PATCH' )?.body ).toEqual( { status: 'published' } ) );

            await user.click( within( row( 'Items', 'Number of Islands' ) ).getByRole( 'button', { name: 'More for Number of Islands' } ) );
            await user.click( screen.getByRole( 'button', { name: 'Delete' } ) );
            expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so nothing changed.' );
        } );

        it( 'says when nothing matches or there are no items, and when loading failed', async () => {
            let answer = () => json( 200, { items: [], total: 0 } );

            api( { 'GET /admin/catalog/items': () => answer() } );
            const user = userEvent.setup();

            renderApp( '/app/admin/catalog?tab=items' );
            expect( await screen.findByText( 'No official items yet.' ) ).toBeInTheDocument();

            await user.selectOptions( screen.getByRole( 'combobox', { name: 'Type' } ), 'Book' );
            expect( await screen.findByText( 'No items match.' ) ).toBeInTheDocument();

            answer = () => json( 500, {} );
            await user.selectOptions( screen.getByRole( 'combobox', { name: 'Type' } ), 'Video' );
            expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong while loading.' );

            await user.click( screen.getByRole( 'button', { name: 'Paths' } ) );
            expect( await screen.findByRole( 'region', { name: 'Paths' } ) ).toBeInTheDocument();
            await user.click( screen.getByRole( 'button', { name: 'Items' } ) );
            expect( screen.getByRole( 'button', { name: 'New item' } ) ).toBeInTheDocument();
        } );
    } );
} );
