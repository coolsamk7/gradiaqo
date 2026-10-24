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
        renderApp( '/app/admin' );

        expect( await screen.findByRole( 'heading', { level: 1, name: 'Global catalog' } ) ).toBeInTheDocument();
        expect( screen.getByTestId( 'location' ) ).toHaveTextContent( '/app/admin/catalog' );
        await screen.findByRole( 'region', { name: 'Paths' } );

        expect( rows( 'Paths' ).map( ( r ) => r.textContent ) ).toEqual( [
            'Data Structures & AlgorithmsPublished425Oct 2Edit',
            'Graph AlgorithmsDraft11TodayEdit',
            'Arrays Crash CourseArchived210Oct 2Edit',
        ] );
        expect( within( row( 'Paths', 'Graph' ) ).getByRole( 'link', { name: 'Edit Graph Algorithms' } ) )
            .toHaveAttribute( 'href', `/app/admin/catalog/paths/${GRAPHS.id}` );
        expect( screen.getByRole( 'link', { name: 'Reports · 1' } ) ).toHaveAttribute( 'href', '/app/admin/reports' );
        expect( screen.getByRole( 'button', { name: 'Paths' } ) ).toHaveAttribute( 'aria-selected', 'true' );
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
        await waitFor( () => expect( screen.getByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach StudyLog right now.' ) );

        answer = () => json( 200, [] );
        await userEvent.setup().click( screen.getByRole( 'button', { name: 'Try again' } ) );
        expect( await screen.findByText( 'No official paths yet.' ) ).toBeInTheDocument();
    } );

    describe( 'Items', () => {
        it( 'lists the official items with their type, status and use', async () => {
            const { calls } = api();

            renderApp( '/app/admin/catalog?tab=items' );
            await screen.findByRole( 'region', { name: 'Items' } );

            expect( screen.getByRole( 'button', { name: 'Items' } ) ).toHaveAttribute( 'aria-selected', 'true' );
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
            await waitFor( () => expect( dialog.getByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach StudyLog right now.' ) );

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
