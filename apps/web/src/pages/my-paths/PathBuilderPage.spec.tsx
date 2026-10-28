import type { LearningPathTreeJson } from '@studylog/schemas';
import { Difficulty, ItemType, OrganizationRole, PathVisibility } from '@studylog/schemas/enums';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { RecordedCall } from '../../test/api.ts';
import { json, loggedIn, mockApi, noContent, pending } from '../../test/api.ts';
import { catalogItem, organization, pathTree, uuid } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';

const WORKSPACE = organization();
const BASE = `/organizations/${WORKSPACE.id}/catalog`;
const PATH_ID = uuid( 400 );
const [ PATTERNS, PRACTICE ] = [ uuid( 500 ), uuid( 501 ) ];
const [ MUST_DO, NICE_TO_HAVE ] = [ uuid( 600 ), uuid( 601 ) ];

const TWO_SUM = catalogItem( uuid( 801 ), 'Two Sum', { difficulty: Difficulty.Easy } );
const CHEAT_SHEET = catalogItem( uuid( 802 ), 'My Pattern Cheat Sheet', { type: ItemType.Note, organizationId: WORKSPACE.id } );
const THREE_SUM = catalogItem( uuid( 803 ), '3Sum', { difficulty: Difficulty.Medium } );
const VIDEO = catalogItem( uuid( 804 ), 'The Two Pointers Technique', { type: ItemType.Video } );

function favourites( overrides: Partial<Omit<LearningPathTreeJson, 'modules'>> = {} ) {
    return pathTree( 'Favourite Problems', [
        {
            title: 'Patterns',
            topics: [
                { title: 'Must Do', items: [ CHEAT_SHEET, { ...TWO_SUM, isOptional: true } ] },
                { title: 'Nice to Have', items: [] },
            ],
        },
        { title: 'Practice Sets', topics: [ { title: 'Week 1', items: [] } ] },
    ], { visibility: PathVisibility.Public, ...overrides } );
}

type Handler = ( init: RequestInit ) => Response | Promise<Response>;

/** The API with the path as `server.tree`; handlers can change it, and the builder loads it again after changes. */
function api( handlers: Record<string, Handler> = {}, tree = favourites(), org = WORKSPACE ) {
    const server = { tree };
    const { calls } = mockApi( {
        ...loggedIn,
        [`GET /organizations/${org.id}`]: () => json( 200, org ),
        [`GET /organizations/${org.id}/catalog/paths/${PATH_ID}`]: () => json( 200, server.tree ),
        ...handlers,
    } );

    return { server, calls };
}

const body = ( init: RequestInit ): unknown => JSON.parse( init.body as string );
const sent = ( calls: RecordedCall[], method: string, path: string ) =>
    calls.filter( ( call ) => call.method === method && call.path === `${BASE}${path}` ).map( ( call ) => call.body );

async function open( path = `/app/my-paths/${WORKSPACE.id}/${PATH_ID}` ) {
    renderApp( path );
    await screen.findByRole( 'heading', { level: 1, name: 'Favourite Problems' } );

    return userEvent.setup();
}

const structure = () => within( screen.getByRole( 'region', { name: 'Structure' } ) );
const editor = () => within( screen.getByRole( 'region', { name: /^(Path|Module|Topic) · / } ) );
const items = () => within( screen.getByRole( 'region', { name: /^Items · / } ) );

describe( 'PathBuilderPage', () => {
    it( 'shows the path\'s structure, with its first topic open and the topic\'s items', async () => {
        api();
        await open();

        expect( screen.getByText( 'Public', { selector: 'span' } ) ).toBeInTheDocument();
        expect( screen.getByText( /changes are live for everyone who follows this path/ ) ).toBeInTheDocument();
        expect( screen.getByRole( 'link', { name: 'Back to my paths' } ) ).toHaveAttribute( 'href', `/app/my-paths?org=${WORKSPACE.id}` );
        expect( screen.getByRole( 'link', { name: 'My paths' } ) ).toHaveAttribute( 'aria-current', 'page' );

        expect( structure().getAllByRole( 'button', { name: /^(Patterns|Practice Sets|Must Do|Nice to Have|Week 1)/ } )
            .map( ( button ) => button.textContent ) ).toEqual( [ 'Patterns', 'Must Do2', 'Nice to Have0', 'Practice Sets', 'Week 10' ] );
        expect( structure().getByRole( 'button', { name: 'Must Do (2 items)' } ) ).toHaveAttribute( 'aria-current', 'true' );

        expect( editor().getByRole( 'heading', { name: 'Topic · Must Do' } ) ).toBeInTheDocument();
        expect( editor().getByText( 'In module Patterns' ) ).toBeInTheDocument();
        expect( editor().getByLabelText( 'Title' ) ).toHaveValue( 'Must Do' );

        expect( items().getByRole( 'heading', { name: 'Items · 2' } ) ).toBeInTheDocument();
        const rows = items().getAllByRole( 'listitem' );

        expect( rows.map( ( row ) => row.textContent ) ).toEqual( [
            expect.stringContaining( 'My Pattern Cheat SheetNote · your item' ),
            expect.stringContaining( 'Two SumProblem · Easy · from the catalog' ),
        ] );
        expect( items().getByRole( 'switch', { name: 'My Pattern Cheat Sheet is optional' } ) ).not.toBeChecked();
        expect( items().getByRole( 'switch', { name: 'Two Sum is optional' } ) ).toBeChecked();
    } );

    it( 'shows loading, and when loading fails, says so and can try again', async () => {
        let answer: Handler = pending;

        api( { [`GET ${BASE}/paths/${PATH_ID}`]: ( init ) => answer( init ) } );
        const first = renderApp( `/app/my-paths/${WORKSPACE.id}/${PATH_ID}` );

        expect( await screen.findByText( 'Loading the path…' ) ).toBeInTheDocument();
        first.unmount();

        answer = () => json( 404, { statusCode: 404, message: 'Not Found' } );
        renderApp( `/app/my-paths/${WORKSPACE.id}/${PATH_ID}` );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'This isn\'t here, or you can\'t edit it.' );

        answer = () => json( 200, favourites() );
        await userEvent.setup().click( screen.getByRole( 'button', { name: 'Try again' } ) );
        expect( await screen.findByRole( 'heading', { level: 1, name: 'Favourite Problems' } ) ).toBeInTheDocument();
    } );

    it( 'starts an empty path on its own details', async () => {
        api( {}, pathTree( 'Favourite Problems', [] ) );
        await open();

        expect( structure().getByText( 'No modules yet. Add one, then add topics to it.' ) ).toBeInTheDocument();
        expect( editor().getByRole( 'heading', { name: 'Path · Favourite Problems' } ) ).toBeInTheDocument();
        expect( editor().getByText( 'Its title and description' ) ).toBeInTheDocument();
    } );

    it( 'keeps showing the path when loading it again after a change fails', async () => {
        let loads = 0;
        const { calls } = api( {
            [`GET ${BASE}/paths/${PATH_ID}`]: () => {
                loads += 1;

                return loads === 1 ? json( 200, favourites() ) : json( 500, { statusCode: 500, message: 'boom' } );
            },
            [`PUT ${BASE}/topics/${MUST_DO}/items/${TWO_SUM.id}`]: () => json( 200, {} ),
        } );
        const user = await open();

        await user.click( items().getByRole( 'switch', { name: 'Two Sum is optional' } ) );

        await waitFor( () => expect( loads ).toBe( 2 ) );
        expect( items().getByRole( 'heading', { name: 'Items · 2' } ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();
        expect( sent( calls, 'PUT', `/topics/${MUST_DO}/items/${TWO_SUM.id}` ) ).toEqual( [ { isOptional: false } ] );
    } );

    it( 'opens a module, the path itself, or another topic, and folds modules away', async () => {
        api();
        const user = await open();

        await user.click( structure().getByRole( 'button', { name: 'Patterns' } ) );
        expect( editor().getByRole( 'heading', { name: 'Module · Patterns' } ) ).toBeInTheDocument();
        expect( editor().getByText( '2 topics' ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'region', { name: /^Items/ } ) ).not.toBeInTheDocument();

        await user.click( structure().getByRole( 'button', { name: 'Practice Sets' } ) );
        expect( editor().getByText( '1 topic' ) ).toBeInTheDocument();

        await user.click( screen.getByRole( 'button', { name: 'Edit details' } ) );
        expect( editor().getByRole( 'heading', { name: 'Path · Favourite Problems' } ) ).toBeInTheDocument();
        // The path is deleted from the header, not here.
        expect( editor().queryByRole( 'button', { name: /^Delete/ } ) ).not.toBeInTheDocument();

        await user.click( structure().getByRole( 'button', { name: 'Week 1 (0 items)' } ) );
        expect( editor().getByRole( 'heading', { name: 'Topic · Week 1' } ) ).toBeInTheDocument();
        expect( items().getByText( /^No items yet/ ) ).toBeInTheDocument();

        await user.click( structure().getByRole( 'button', { name: 'Collapse Patterns' } ) );
        expect( structure().queryByRole( 'button', { name: /^Must Do/ } ) ).not.toBeInTheDocument();
        await user.click( structure().getByRole( 'button', { name: 'Expand Patterns' } ) );
        expect( structure().getByRole( 'button', { name: /^Must Do/ } ) ).toBeInTheDocument();
    } );

    describe( 'editing', () => {
        it( 'saves a new title and description, and an emptied description as none', async () => {
            const { server, calls } = api( {
                [`PATCH ${BASE}/topics/${MUST_DO}`]: ( init ) => {
                    const { title } = body( init ) as { title: string };

                    server.tree.modules[0].topics[0].title = title;

                    return json( 200, {} );
                },
            } );
            const user = await open();

            expect( editor().getByRole( 'button', { name: 'Save changes' } ) ).toBeDisabled();
            await user.clear( editor().getByLabelText( 'Title' ) );
            await user.click( editor().getByRole( 'button', { name: 'Save changes' } ) );
            expect( editor().getByText( 'Enter a title.' ) ).toBeInTheDocument();

            await user.type( editor().getByLabelText( 'Title' ), ' Must Redo ' );
            await user.type( editor().getByLabelText( 'Description (optional)' ), 'Before any interview.' );
            await user.click( editor().getByRole( 'button', { name: 'Save changes' } ) );

            expect( await editor().findByRole( 'status' ) ).toHaveTextContent( 'Saved' );
            expect( editor().getByRole( 'heading', { name: 'Topic · Must Redo' } ) ).toBeInTheDocument();
            expect( structure().getByRole( 'button', { name: 'Must Redo (2 items)' } ) ).toBeInTheDocument();
            expect( sent( calls, 'PATCH', `/topics/${MUST_DO}` ) ).toEqual( [ { title: 'Must Redo', description: 'Before any interview.' } ] );

            await user.clear( editor().getByLabelText( 'Description (optional)' ) );
            expect( editor().queryByRole( 'status' ) ).not.toBeInTheDocument();
            await user.type( editor().getByLabelText( 'Title' ), '!' );
            await user.click( editor().getByRole( 'button', { name: 'Save changes' } ) );
            await waitFor( () => expect( sent( calls, 'PATCH', `/topics/${MUST_DO}` ).at( -1 ) )
                .toEqual( { title: 'Must Redo!', description: null } ) );
        } );

        it( 'explains a title that\'s taken', async () => {
            api( { [`PATCH ${BASE}/modules/${PATTERNS}`]: () => json( 409, { statusCode: 409, message: 'taken' } ) } );
            const user = await open();

            await user.click( structure().getByRole( 'button', { name: 'Patterns' } ) );
            await user.type( editor().getByLabelText( 'Title' ), '!' );
            await user.click( editor().getByRole( 'button', { name: 'Save changes' } ) );

            expect( await editor().findByRole( 'alert' ) ).toHaveTextContent( 'There\'s already a module with this title here.' );
        } );

        it( 'deletes a topic after asking, then opens the next one', async () => {
            const { server, calls } = api( {
                [`DELETE ${BASE}/topics/${MUST_DO}`]: () => {
                    server.tree.modules[0].topics.shift();

                    return noContent();
                },
            } );
            const user = await open();

            await user.click( editor().getByRole( 'button', { name: 'Delete topic' } ) );
            const confirm = within( editor().getByRole( 'group', { name: 'Delete this topic?' } ) );

            expect( confirm.getByText( 'Delete this topic? Its items stay in your catalog.' ) ).toBeInTheDocument();
            await user.click( confirm.getByRole( 'button', { name: 'Cancel' } ) );
            expect( calls.some( ( call ) => call.method === 'DELETE' ) ).toBe( false );

            await user.click( editor().getByRole( 'button', { name: 'Delete topic' } ) );
            await user.click( editor().getByRole( 'button', { name: 'Delete' } ) );

            expect( await editor().findByRole( 'heading', { name: 'Topic · Nice to Have' } ) ).toBeInTheDocument();
            expect( structure().queryByRole( 'button', { name: /^Must Do/ } ) ).not.toBeInTheDocument();
        } );
    } );

    describe( 'structure', () => {
        it( 'adds a module and opens it', async () => {
            const { server, calls } = api( {
                [`POST ${BASE}/paths/${PATH_ID}/modules`]: ( init ) => {
                    const { title } = body( init ) as { title: string };
                    const added = { ...server.tree.modules[1], id: uuid( 502 ), title, topics: [] };

                    server.tree.modules.push( added );

                    return json( 201, added );
                },
            } );
            const user = await open();

            await user.click( structure().getByRole( 'button', { name: 'Add a module' } ) );
            expect( structure().getByLabelText( 'Module title' ) ).toHaveFocus();
            await user.keyboard( '{Enter}' );
            expect( structure().getByRole( 'alert' ) ).toHaveTextContent( 'Enter a title.' );
            expect( structure().getByLabelText( 'Module title' ) ).toHaveAttribute( 'aria-invalid', 'true' );

            await user.keyboard( '{Escape}' );
            expect( structure().queryByLabelText( 'Module title' ) ).not.toBeInTheDocument();
            await user.click( structure().getByRole( 'button', { name: 'Add a module' } ) );
            await user.keyboard( 'x' );
            await user.click( structure().getByRole( 'button', { name: 'Cancel' } ) );
            await user.click( structure().getByRole( 'button', { name: 'Add a module' } ) );
            // Cancel forgot what was typed.
            expect( structure().getByLabelText( 'Module title' ) ).toHaveValue( '' );

            await user.keyboard( ' Graphs {Enter}' );
            expect( await editor().findByRole( 'heading', { name: 'Module · Graphs' } ) ).toBeInTheDocument();
            expect( sent( calls, 'POST', `/paths/${PATH_ID}/modules` ) ).toEqual( [ { title: 'Graphs' } ] );
            expect( structure().getByRole( 'button', { name: 'Add a module' } ) ).toBeInTheDocument();
        } );

        it( 'adds a topic to a module and opens it; explains a title that\'s taken', async () => {
            let answer: Handler = () => json( 409, { statusCode: 409, message: 'taken' } );
            const { server } = api( { [`POST ${BASE}/modules/${PRACTICE}/topics`]: ( init ) => answer( init ) } );
            const user = await open();

            await user.click( structure().getByRole( 'button', { name: 'Add a topic to Practice Sets' } ) );
            await user.keyboard( 'Week 1{Enter}' );
            expect( await structure().findByRole( 'alert' ) ).toHaveTextContent( 'There\'s already a topic with this title here.' );

            answer = () => {
                const added = { ...server.tree.modules[1].topics[0], id: uuid( 611 ), title: 'Week 2' };

                server.tree.modules[1].topics.push( added );

                return json( 201, added );
            };
            await user.clear( structure().getByLabelText( 'Topic title' ) );
            await user.keyboard( 'Week 2{Enter}' );

            expect( await editor().findByRole( 'heading', { name: 'Topic · Week 2' } ) ).toBeInTheDocument();
            expect( structure().getByRole( 'button', { name: 'Week 2 (0 items)' } ) ).toHaveAttribute( 'aria-current', 'true' );
        } );

        it( 'moves modules and topics up and down', async () => {
            const { calls } = api( {
                [`PUT ${BASE}/paths/${PATH_ID}/modules/order`]: () => json( 200, [] ),
                [`PUT ${BASE}/modules/${PATTERNS}/topics/order`]: () => json( 500, { statusCode: 500, message: 'boom' } ),
            } );
            const user = await open();

            await user.click( structure().getByRole( 'button', { name: 'More for Patterns' } ) );
            const menu = within( structure().getByRole( 'button', { name: 'More for Patterns' } ).parentElement! );

            // The first module can't go up.
            expect( menu.getAllByRole( 'button' ).map( ( button ) => button.textContent ) ).toEqual( [ '', 'Move down', 'Edit or delete' ] );
            await user.click( menu.getByRole( 'button', { name: 'Move down' } ) );
            await waitFor( () => expect( sent( calls, 'PUT', `/paths/${PATH_ID}/modules/order` ) )
                .toEqual( [ { ids: [ PRACTICE, PATTERNS ] } ] ) );

            await user.click( structure().getByRole( 'button', { name: 'More for Practice Sets' } ) );
            await user.click( structure().getByRole( 'button', { name: 'Move up' } ) );
            await waitFor( () => expect( sent( calls, 'PUT', `/paths/${PATH_ID}/modules/order` ) ).toHaveLength( 2 ) );

            await user.click( structure().getByRole( 'button', { name: 'More for Nice to Have' } ) );
            await user.click( structure().getByRole( 'button', { name: 'Move up' } ) );
            expect( await structure().findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so it wasn\'t saved.' );
            expect( sent( calls, 'PUT', `/modules/${PATTERNS}/topics/order` ) ).toEqual( [ { ids: [ NICE_TO_HAVE, MUST_DO ] } ] );

            await user.click( structure().getByRole( 'button', { name: 'More for Must Do' } ) );
            await user.click( structure().getByRole( 'button', { name: 'Move down' } ) );
            expect( sent( calls, 'PUT', `/modules/${PATTERNS}/topics/order` ).at( -1 ) ).toEqual( { ids: [ NICE_TO_HAVE, MUST_DO ] } );
        } );

        it( 'opens a module or topic from its menu; the menu closes on Escape or when focus leaves it', async () => {
            api();
            const user = await open();
            const trigger = structure().getByRole( 'button', { name: 'More for Week 1' } );

            await user.click( trigger );
            expect( trigger ).toHaveAttribute( 'aria-expanded', 'true' );
            await user.keyboard( '{Escape}' );
            expect( trigger ).toHaveAttribute( 'aria-expanded', 'false' );

            await user.click( trigger );
            await user.keyboard( '{Tab}' );
            expect( trigger ).toHaveAttribute( 'aria-expanded', 'true' );
            await user.click( document.body );
            expect( trigger ).toHaveAttribute( 'aria-expanded', 'false' );

            await user.click( trigger );
            await user.click( trigger );
            expect( trigger ).toHaveAttribute( 'aria-expanded', 'false' );

            await user.click( trigger );
            await user.click( structure().getByRole( 'button', { name: 'Edit or delete' } ) );
            expect( editor().getByRole( 'heading', { name: 'Topic · Week 1' } ) ).toBeInTheDocument();

            await user.click( structure().getByRole( 'button', { name: 'More for Practice Sets' } ) );
            await user.click( structure().getByRole( 'button', { name: 'Edit or delete' } ) );
            expect( editor().getByRole( 'heading', { name: 'Module · Practice Sets' } ) ).toBeInTheDocument();
            expect( editor().getByRole( 'button', { name: 'Delete module' } ) ).toBeInTheDocument();
        } );
    } );

    describe( 'items', () => {
        it( 'marks items optional, moves and removes them', async () => {
            const { server, calls } = api( {
                [`PUT ${BASE}/topics/${MUST_DO}/items/${CHEAT_SHEET.id}`]: ( init ) => {
                    const { isOptional } = body( init ) as { isOptional: boolean };

                    server.tree.modules[0].topics[0].items[0].isOptional = isOptional;

                    return json( 200, {} );
                },
                [`PUT ${BASE}/topics/${MUST_DO}/items/order`]: () => json( 200, [] ),
                [`DELETE ${BASE}/topics/${MUST_DO}/items/${TWO_SUM.id}`]: () => {
                    server.tree.modules[0].topics[0].items.pop();

                    return noContent();
                },
            } );
            const user = await open();

            await user.click( items().getByRole( 'switch', { name: 'My Pattern Cheat Sheet is optional' } ) );
            await waitFor( () => expect( items().getByRole( 'switch', { name: 'My Pattern Cheat Sheet is optional' } ) ).toBeChecked() );
            expect( sent( calls, 'PUT', `/topics/${MUST_DO}/items/${CHEAT_SHEET.id}` ) ).toEqual( [ { isOptional: true } ] );

            await user.click( items().getByRole( 'button', { name: 'More for My Pattern Cheat Sheet' } ) );
            expect( items().queryByRole( 'button', { name: 'Move up' } ) ).not.toBeInTheDocument();
            await user.click( items().getByRole( 'button', { name: 'Move down' } ) );
            await user.click( items().getByRole( 'button', { name: 'More for Two Sum' } ) );
            await user.click( items().getByRole( 'button', { name: 'Move up' } ) );
            await waitFor( () => expect( sent( calls, 'PUT', `/topics/${MUST_DO}/items/order` ) ).toEqual( [
                { ids: [ TWO_SUM.id, CHEAT_SHEET.id ] },
                { ids: [ TWO_SUM.id, CHEAT_SHEET.id ] },
            ] ) );

            await user.click( items().getByRole( 'button', { name: 'More for Two Sum' } ) );
            await user.click( items().getByRole( 'button', { name: 'Remove from topic' } ) );
            await waitFor( () => expect( items().getByRole( 'heading', { name: 'Items · 1' } ) ).toBeInTheDocument() );
            expect( structure().getByRole( 'button', { name: 'Must Do (1 item)' } ) ).toBeInTheDocument();
        } );

        it( 'says when a change to an item wasn\'t saved', async () => {
            api( { [`PUT ${BASE}/topics/${MUST_DO}/items/${TWO_SUM.id}`]: () => Promise.reject( new TypeError( 'offline' ) ) } );
            const user = await open();

            await user.click( items().getByRole( 'switch', { name: 'Two Sum is optional' } ) );

            expect( await items().findByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach Gradiaqo right now.' );
            expect( items().getByRole( 'switch', { name: 'Two Sum is optional' } ) ).toBeChecked();
        } );
    } );

    describe( 'New item', () => {
        it( 'creates a problem and adds it to the topic', async () => {
            const { server, calls } = api( {
                [`POST ${BASE}/items`]: () => json( 201, { id: uuid( 805 ) } ),
                [`PUT ${BASE}/topics/${MUST_DO}/items/${uuid( 805 )}`]: () => {
                    server.tree.modules[0].topics[0].items.push( {
                        ...catalogItem( uuid( 805 ), 'Merge Intervals', { organizationId: WORKSPACE.id } ),
                        position: 2,
                        isOptional: false,
                    } );

                    return json( 200, {} );
                },
            } );
            const user = await open();

            await user.click( items().getByRole( 'button', { name: 'New item' } ) );
            const form = within( screen.getByRole( 'region', { name: 'New item' } ) );

            expect( form.getByLabelText( 'Title' ) ).toHaveFocus();
            expect( form.getByLabelText( 'Type' ) ).toHaveValue( ItemType.Problem );
            await user.type( form.getByLabelText( 'Title' ), 'Merge Intervals' );
            await user.type( form.getByLabelText( 'Link' ), 'https://leetcode.com/problems/merge-intervals/' );
            await user.selectOptions( form.getByLabelText( 'Difficulty' ), Difficulty.Medium );
            await user.type( form.getByLabelText( 'Minutes (optional)' ), '25' );
            await user.click( form.getByRole( 'button', { name: 'Add item' } ) );

            await waitFor( () => expect( screen.queryByRole( 'region', { name: 'New item' } ) ).not.toBeInTheDocument() );
            expect( items().getByText( 'Merge Intervals' ) ).toBeInTheDocument();
            expect( sent( calls, 'POST', '/items' ) ).toEqual( [ {
                type: ItemType.Problem,
                title: 'Merge Intervals',
                details: { url: 'https://leetcode.com/problems/merge-intervals/', platform: 'leetcode' },
                difficulty: Difficulty.Medium,
                estimatedMinutes: 25,
            } ] );
            expect( sent( calls, 'PUT', `/topics/${MUST_DO}/items/${uuid( 805 )}` ) ).toEqual( [ {} ] );
        } );

        it( 'asks for what each type needs, before and after asking the API', async () => {
            let answer: Handler = () => json( 400, {
                statusCode: 400,
                message: 'Bad Request',
                errors: [ { path: '/details/content', message: 'must not be empty' } ],
            } );
            const { calls } = api( { [`POST ${BASE}/items`]: ( init ) => answer( init ) } );
            const user = await open();

            await user.click( items().getByRole( 'button', { name: 'New item' } ) );
            const form = within( screen.getByRole( 'region', { name: 'New item' } ) );

            await user.click( form.getByRole( 'button', { name: 'Add item' } ) );
            expect( form.getByText( 'Enter a title.' ) ).toBeInTheDocument();
            expect( form.getByText( 'Enter a link.' ) ).toBeInTheDocument();
            expect( form.getByLabelText( 'Title' ) ).toHaveFocus();
            expect( calls.some( ( call ) => call.path === `${BASE}/items` ) ).toBe( false );

            await user.selectOptions( form.getByLabelText( 'Type' ), ItemType.Note );
            expect( form.queryByLabelText( 'Link' ) ).not.toBeInTheDocument();
            expect( form.queryByLabelText( 'Difficulty' ) ).not.toBeInTheDocument();
            await user.type( form.getByLabelText( 'Title' ), 'Cheat sheet' );
            await user.type( form.getByLabelText( 'Note' ), 'Two pointers: sorted input.' );
            await user.click( form.getByRole( 'button', { name: 'Add item' } ) );
            expect( await form.findByText( 'Note must not be empty.' ) ).toBeInTheDocument();
            expect( form.getByLabelText( 'Note' ) ).toHaveFocus();

            answer = () => json( 500, { statusCode: 500, message: 'boom' } );
            await user.click( form.getByRole( 'button', { name: 'Add item' } ) );
            expect( await form.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so it wasn\'t saved.' );
            expect( form.queryByText( 'Note must not be empty.' ) ).not.toBeInTheDocument();

            answer = () => Promise.reject( new TypeError( 'offline' ) );
            await user.click( form.getByRole( 'button', { name: 'Add item' } ) );
            await waitFor( () => expect( form.getByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach Gradiaqo right now.' ) );

            answer = pending;
            await user.click( form.getByRole( 'button', { name: 'Add item' } ) );
            expect( form.getByRole( 'button', { name: 'Adding…' } ) ).toBeDisabled();

            await user.selectOptions( form.getByLabelText( 'Type' ), ItemType.Exercise );
            expect( form.getByLabelText( 'Instructions' ) ).toBeInTheDocument();
            expect( form.getByLabelText( 'Answer (optional)' ) ).toBeInTheDocument();
            expect( form.getByLabelText( 'Difficulty' ) ).toBeInTheDocument();
            await user.selectOptions( form.getByLabelText( 'Type' ), ItemType.Course );
            expect( form.getByLabelText( 'Provider (optional)' ) ).toBeInTheDocument();

            await user.click( form.getByRole( 'button', { name: 'Cancel' } ) );
            expect( screen.queryByRole( 'region', { name: 'New item' } ) ).not.toBeInTheDocument();
        } );
    } );

    describe( 'Link from catalog', () => {
        it( 'finds catalog items and links them into the topic', async () => {
            const { server, calls } = api( {
                'GET /catalog/items': () => {
                    const fetchMock = globalThis.fetch as unknown as { mock: { lastCall: [ string ] } };
                    const search = new URL( fetchMock.mock.lastCall[0] ).searchParams.get( 'search' );
                    const found = search === 'sum' ? [ THREE_SUM, TWO_SUM ] : [ THREE_SUM, TWO_SUM, VIDEO ];

                    return json( 200, { items: search === 'zzz' ? [] : found, total: 3 } );
                },
                [`PUT ${BASE}/topics/${MUST_DO}/items/${THREE_SUM.id}`]: () => {
                    server.tree.modules[0].topics[0].items.push( { ...THREE_SUM, position: 2, isOptional: false } );

                    return json( 200, {} );
                },
                [`PUT ${BASE}/topics/${MUST_DO}/items/${VIDEO.id}`]: () => json( 404, { statusCode: 404, message: 'Item not found' } ),
            } );
            const user = await open();

            await user.click( items().getByRole( 'button', { name: 'Link from catalog' } ) );
            const dialog = within( screen.getByRole( 'dialog', { name: 'Link items from the catalog' } ) );

            expect( dialog.getByRole( 'searchbox', { name: 'Search the catalog' } ) ).toHaveFocus();
            expect( await dialog.findByText( 'The Two Pointers Technique' ) ).toBeInTheDocument();
            expect( dialog.getByText( 'Video' ) ).toBeInTheDocument();
            // Already in the topic.
            expect( within( dialog.getByText( 'Two Sum' ).closest( 'li' )! ).getByText( 'Linked' ) ).toBeInTheDocument();

            await user.type( dialog.getByRole( 'searchbox' ), 'sum' );
            await waitFor( () => expect( calls.filter( ( call ) => call.path === '/catalog/items' ).map( ( call ) => call.query ) )
                .toEqual( [ '?limit=20', '?limit=20&search=sum' ] ) );

            await user.click( await dialog.findByRole( 'button', { name: 'Link 3Sum' } ) );
            expect( await dialog.findByText( '1 linked to Must Do' ) ).toBeInTheDocument();
            expect( within( dialog.getByText( '3Sum' ).closest( 'li' )! ).getByText( 'Linked' ) ).toBeInTheDocument();
            expect( items().getByRole( 'heading', { name: 'Items · 3' } ) ).toBeInTheDocument();

            await user.clear( dialog.getByRole( 'searchbox' ) );
            await user.click( await dialog.findByRole( 'button', { name: 'Link The Two Pointers Technique' } ) );
            expect( await dialog.findByRole( 'alert' ) ).toHaveTextContent( 'This was removed, maybe in another tab.' );

            await user.type( dialog.getByRole( 'searchbox' ), 'zzz' );
            expect( await dialog.findByText( 'Nothing in the catalog matches “zzz”.' ) ).toBeInTheDocument();

            await user.click( dialog.getByRole( 'button', { name: 'Done' } ) );
            expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
        } );

        it( 'says when the catalog is empty or can\'t be searched', async () => {
            let answer: Handler = () => json( 200, { items: [], total: 0 } );

            api( { 'GET /catalog/items': ( init ) => answer( init ) } );
            const user = await open();

            await user.click( items().getByRole( 'button', { name: 'Link from catalog' } ) );
            expect( await screen.findByText( 'The catalog is empty.' ) ).toBeInTheDocument();

            answer = () => Promise.reject( new TypeError( 'offline' ) );
            await user.type( screen.getByRole( 'searchbox' ), 'a' );
            expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach Gradiaqo right now.' );
        } );

        it( 'ignores an answer that comes back after the search changed', async () => {
            let releaseFirst!: ( response: Response ) => void;

            api( {
                'GET /catalog/items': () => {
                    const fetchMock = globalThis.fetch as unknown as { mock: { lastCall: [ string ] } };

                    return new URL( fetchMock.mock.lastCall[0] ).search === '?limit=20'
                        ? new Promise<Response>( ( resolve ) => {
                                releaseFirst = resolve;
                            } )
                        : json( 200, { items: [ THREE_SUM ], total: 1 } );
                },
            } );
            const user = await open();

            await user.click( items().getByRole( 'button', { name: 'Link from catalog' } ) );
            await user.type( screen.getByRole( 'searchbox' ), '3' );
            expect( await screen.findByText( '3Sum' ) ).toBeInTheDocument();

            releaseFirst( json( 200, { items: [ VIDEO ], total: 1 } ) );
            await new Promise( ( resolve ) => setTimeout( resolve, 20 ) );
            expect( screen.queryByText( 'The Two Pointers Technique' ) ).not.toBeInTheDocument();
        } );
    } );

    describe( 'header', () => {
        it( 'makes a workspace path private or public', async () => {
            let answer: Handler = () => json( 500, { statusCode: 500, message: 'boom' } );
            const { server, calls } = api( { [`PATCH ${BASE}/paths/${PATH_ID}`]: ( init ) => answer( init ) } );
            const user = await open();
            const toggle = screen.getByRole( 'switch', { name: 'Public' } );

            expect( toggle ).toBeChecked();
            await user.click( toggle );
            expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so it wasn\'t saved.' );

            answer = ( init ) => {
                server.tree = { ...server.tree, ...body( init ) as object };

                return json( 200, {} );
            };
            await user.click( toggle );
            await waitFor( () => expect( screen.getByRole( 'switch', { name: 'Public' } ) ).not.toBeChecked() );
            expect( screen.getByText( 'Private', { selector: 'span' } ) ).toBeInTheDocument();
            expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();
            expect( sent( calls, 'PATCH', `/paths/${PATH_ID}` ).at( -1 ) ).toEqual( { visibility: PathVisibility.Private } );

            await user.click( screen.getByRole( 'switch', { name: 'Public' } ) );
            await waitFor( () => expect( sent( calls, 'PATCH', `/paths/${PATH_ID}` ).at( -1 ) )
                .toEqual( { visibility: PathVisibility.Public } ) );
        } );

        it( 'can\'t make public again a path a moderator took out of the catalog', async () => {
            api( {}, favourites( { visibility: PathVisibility.Private, publicBlockedAt: '2026-09-01T09:00:00.000Z' } ) );
            await open();

            expect( screen.queryByRole( 'switch', { name: 'Public' } ) ).not.toBeInTheDocument();
        } );

        it( 'in an organization, has no public or private', async () => {
            const acme = organization( { id: uuid( 5 ), name: 'Acme Study Group', isPersonal: false, role: OrganizationRole.Admin } );

            api( {}, favourites( { organizationId: acme.id } ), acme );
            await open( `/app/my-paths/${acme.id}/${PATH_ID}` );

            expect( screen.getByText( /^In Acme Study Group · changes are live for every member/ ) ).toBeInTheDocument();
            expect( screen.queryByRole( 'switch', { name: 'Public' } ) ).not.toBeInTheDocument();
            expect( screen.queryByText( 'Private', { selector: 'span' } ) ).not.toBeInTheDocument();
        } );

        it( 'deletes the path after asking, and goes back to My paths', async () => {
            let answer: Handler = () => json( 500, { statusCode: 500, message: 'boom' } );

            api( {
                [`DELETE ${BASE}/paths/${PATH_ID}`]: ( init ) => answer( init ),
                'GET /organizations': pending,
            } );
            const user = await open();

            await user.click( screen.getByRole( 'button', { name: 'Delete path' } ) );
            const confirm = within( screen.getByRole( 'group', { name: 'Delete this path?' } ) );

            await user.click( confirm.getByRole( 'button', { name: 'Cancel' } ) );
            expect( screen.queryByRole( 'group', { name: 'Delete this path?' } ) ).not.toBeInTheDocument();

            await user.click( screen.getByRole( 'button', { name: 'Delete path' } ) );
            await user.click( screen.getByRole( 'button', { name: 'Delete' } ) );
            expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so it wasn\'t saved.' );

            answer = () => noContent();
            await user.click( screen.getByRole( 'button', { name: 'Delete' } ) );
            await waitFor( () => expect( screen.getByTestId( 'location' ) ).toHaveTextContent( '/app/my-paths' ) );
        } );
    } );
} );
