import type { PublishedPathJson } from '@studylog/schemas';
import { EnrollmentStatus, ItemType, PathVisibility } from '@studylog/schemas/enums';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { json, loggedIn, mockApi, pending } from '../../test/api.ts';
import type { TreeSpec } from '../../test/fixtures.ts';
import { enrollment, enrollmentDetail, publishedPath, uuid } from '../../test/fixtures.ts';
import { renderApp } from '../../test/render.tsx';

const SPEC: TreeSpec[] = [
    { title: 'Foundations', topics: [
        { id: uuid( 1 ), title: 'Scalability', items: [
            { id: uuid( 11 ), title: 'Scalability for Dummies', type: ItemType.Article, estimatedMinutes: 30 },
            { id: uuid( 12 ), title: 'Designing Data-Intensive Applications', type: ItemType.Book, details: { chapters: 'Ch. 1-3' }, optional: true },
        ] },
        { id: uuid( 2 ), title: 'Caching', items: [ { id: uuid( 13 ), title: 'Design an LRU Cache' } ] },
    ] },
    { title: 'Practice', topics: [
        { id: uuid( 3 ), title: 'Design Exercises', items: [ { id: uuid( 14 ), title: 'URL Shortener' } ] },
        { id: uuid( 4 ), title: 'Coming Soon', items: [] },
    ] },
];

const PATH = publishedPath( 'System Design Fundamentals', SPEC, {
    id: uuid( 300 ),
    description: 'How large systems stay fast and available.',
    contents: { modules: 2, items: 4, estimatedMinutes: 2040 },
    updatedAt: '2026-10-05T10:00:00.000Z',
} );
const URL = `/catalog/paths/${PATH.id}`;
const ENROLLED = enrollmentDetail( enrollment( 'System Design Fundamentals', EnrollmentStatus.Active, 0, 3, uuid( 900 ) ), SPEC );

type Handlers = Parameters<typeof mockApi>[0];

function api( path: PublishedPathJson = PATH, handlers: Handlers = {} ) {
    return mockApi( {
        ...loggedIn,
        [`GET ${URL}`]: () => json( 200, path ),
        'POST /me/enrollments': () => json( 201, ENROLLED ),
        [`GET /me/enrollments/${ENROLLED.id}`]: () => json( 200, ENROLLED ),
        ...handlers,
    } );
}

const topic = ( title: string ) => screen.getByRole( 'heading', { level: 3, name: title } ).closest( 'details' )!;

describe( 'PathPreviewPage', () => {
    it( 'shows the path, what\'s in it and where it comes from', async () => {
        api();
        renderApp( `/app/catalog/${PATH.id}` );

        expect( await screen.findByRole( 'heading', { level: 1, name: 'System Design Fundamentals' } ) ).toBeInTheDocument();
        expect( screen.getByText( 'Official' ) ).toBeInTheDocument();
        expect( screen.queryByText( 'Enrolled' ) ).not.toBeInTheDocument();
        expect( screen.getByText( 'How large systems stay fast and available.' ) ).toBeInTheDocument();
        expect( screen.getByRole( 'list', { name: 'Contents' } ) ).toHaveTextContent( '2 modules4 items≈ 34hBy StudyLog' );
        expect( screen.getByRole( 'link', { name: 'Back to Browse paths' } ) ).toHaveAttribute( 'href', '/app/catalog' );
        expect( screen.getByRole( 'link', { name: 'Browse paths' } ) ).toHaveAttribute( 'aria-current', 'page' );

        expect( screen.getByRole( 'region', { name: 'Foundations' } ) ).toHaveTextContent( '2 topics' );
        expect( topic( 'Scalability' ).open ).toBe( true );
        expect( topic( 'Caching' ).open ).toBe( false );
        expect( within( topic( 'Scalability' ) ).getAllByRole( 'listitem' ).map( ( item ) => item.textContent ) ).toEqual( [
            'Scalability for DummiesArticle · 30 min',
            'Designing Data-Intensive ApplicationsBook · Ch. 1-3 · Optional',
        ] );
        expect( topic( 'Coming Soon' ) ).toHaveTextContent( '0 itemsNo items in this topic yet.' );

        const about = screen.getByRole( 'region', { name: 'About' } );

        expect( about ).toHaveTextContent( 'SourceOfficial catalogUpdatedOct 2026VisibilityPublic' );
    } );

    it( 'enrolls in the whole path, then opens it', async () => {
        const { calls } = api();

        renderApp( `/app/catalog/${PATH.id}` );
        await userEvent.setup().click( ( await screen.findAllByRole( 'button', { name: 'Enroll' } ) )[0] );

        await waitFor( () => expect( screen.getByTestId( 'location' ) ).toHaveTextContent( `/app/paths/${ENROLLED.id}` ) );
        expect( calls.find( ( call ) => call.method === 'POST' && call.path === '/me/enrollments' )?.body ).toEqual( { learningPathId: PATH.id } );
    } );

    it( 'enrolls in the parts the user picks', async () => {
        const { calls } = api();
        const user = userEvent.setup();

        renderApp( `/app/catalog/${PATH.id}` );
        await user.click( ( await screen.findAllByRole( 'button', { name: 'Choose parts' } ) )[0] );

        const dialog = screen.getByRole( 'dialog', { name: 'Choose what to follow' } );
        const box = ( name: string ) => within( dialog ).getByRole( 'checkbox', { name: new RegExp( `^${name}` ) } );

        // Everything ticked at first; an empty topic still shows.
        expect( within( dialog ).getAllByRole( 'checkbox' ) ).toHaveLength( 6 );
        expect( dialog ).toHaveTextContent( '4 of 4 items selected' );
        expect( box( 'Scalability' ) ).toBeChecked();

        await user.click( box( 'Practice' ) );
        expect( box( 'Design Exercises' ) ).not.toBeChecked();
        await user.click( box( 'Caching' ) );
        expect( box( 'Foundations' ) ).toHaveAttribute( 'aria-checked', 'mixed' );
        expect( ( box( 'Foundations' ) as HTMLInputElement ).indeterminate ).toBe( true );
        expect( dialog ).toHaveTextContent( '2 of 4 items selected' );

        // Ticking a partly ticked module ticks all of it.
        await user.click( box( 'Foundations' ) );
        expect( box( 'Caching' ) ).toBeChecked();
        await user.click( box( 'Caching' ) );

        await user.click( within( dialog ).getByRole( 'button', { name: 'Enroll' } ) );
        await waitFor( () => expect( screen.getByTestId( 'location' ) ).toHaveTextContent( `/app/paths/${ENROLLED.id}` ) );
        expect( calls.find( ( call ) => call.method === 'POST' && call.path === '/me/enrollments' )?.body ).toEqual( {
            learningPathId: PATH.id,
            rules: [ { scope: 'topic', scopeId: uuid( 1 ), mode: 'include' } ],
        } );
    } );

    it( 'needs at least one topic, and can be closed', async () => {
        const { calls } = api();
        const user = userEvent.setup();

        renderApp( `/app/catalog/${PATH.id}` );
        await user.click( ( await screen.findAllByRole( 'button', { name: 'Choose parts' } ) )[1] );
        const dialog = screen.getByRole( 'dialog' );

        await user.click( within( dialog ).getByRole( 'checkbox', { name: /^Foundations/ } ) );
        await user.click( within( dialog ).getByRole( 'checkbox', { name: /^Practice/ } ) );
        expect( dialog ).toHaveTextContent( '0 of 4 items selected' );
        await user.click( within( dialog ).getByRole( 'button', { name: 'Enroll' } ) );
        expect( within( dialog ).getByRole( 'alert' ) ).toHaveTextContent( 'Choose at least one topic.' );

        await user.click( within( dialog ).getByRole( 'button', { name: 'Cancel' } ) );
        expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();
        expect( calls.some( ( call ) => call.path === '/me/enrollments' ) ).toBe( false );
    } );

    it( 'says why enrolling failed', async () => {
        let answer = () => json( 409, { statusCode: 409, message: 'Conflict' } );

        api( PATH, { 'POST /me/enrollments': () => answer() } );
        const user = userEvent.setup();

        renderApp( `/app/catalog/${PATH.id}` );
        const enroll = ( await screen.findAllByRole( 'button', { name: 'Enroll' } ) )[1];

        await user.click( enroll );
        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'You already follow this path.' );
        expect( enroll ).toBeEnabled();

        // In the dialog too.
        await user.click( screen.getAllByRole( 'button', { name: 'Choose parts' } )[0] );
        answer = () => json( 500, {} );
        await user.click( within( screen.getByRole( 'dialog' ) ).getByRole( 'button', { name: 'Enroll' } ) );
        expect( await within( screen.getByRole( 'dialog' ) ).findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong, so you weren\'t enrolled.' );

        answer = () => new Promise<Response>( () => undefined ) as unknown as Response;
        await user.click( within( screen.getByRole( 'dialog' ) ).getByRole( 'button', { name: 'Enroll' } ) );
        expect( await within( screen.getByRole( 'dialog' ) ).findByRole( 'button', { name: 'Saving…' } ) ).toBeDisabled();
    } );

    it( 'waits while enrolling', async () => {
        api( PATH, { 'POST /me/enrollments': pending } );
        renderApp( `/app/catalog/${PATH.id}` );
        await userEvent.setup().click( ( await screen.findAllByRole( 'button', { name: 'Enroll' } ) )[0] );

        expect( screen.getAllByRole( 'button', { name: 'Enrolling…' } ).every( ( button ) => ( button as HTMLButtonElement ).disabled ) ).toBe( true );
    } );

    it( 'links a path the user follows to their own view and its settings', async () => {
        api( { ...PATH, enrollmentId: ENROLLED.id } );
        renderApp( `/app/catalog/${PATH.id}` );

        expect( await screen.findByText( 'Enrolled' ) ).toBeInTheDocument();
        expect( screen.queryByRole( 'button', { name: 'Enroll' } ) ).not.toBeInTheDocument();
        expect( screen.getAllByRole( 'link', { name: /^Continue/ } ).map( ( link ) => link.getAttribute( 'href' ) ) )
            .toEqual( [ `/app/paths/${ENROLLED.id}`, `/app/paths/${ENROLLED.id}` ] );
        expect( screen.getByRole( 'link', { name: 'Path settings' } ) ).toHaveAttribute( 'href', `/app/paths/${ENROLLED.id}/settings` );
        expect( screen.getByRole( 'heading', { name: 'You follow this path' } ) ).toBeInTheDocument();
    } );

    it( 'shows a community path without content or estimates', async () => {
        api( {
            ...publishedPath( 'Graph Practice', [] ),
            id: PATH.id,
            visibility: PathVisibility.Private,
            organization: { id: uuid( 5 ), name: 'Bob', isPersonal: true },
            createdBy: { id: uuid( 6 ), firstName: 'Bob', lastName: 'Lee' },
        } );
        renderApp( `/app/catalog/${PATH.id}` );

        expect( await screen.findByText( 'This path has no content yet.' ) ).toBeInTheDocument();
        expect( screen.getAllByText( 'Community' ) ).toHaveLength( 2 );
        expect( screen.getByRole( 'list', { name: 'Contents' } ) ).toHaveTextContent( '0 modules0 itemsBy Bob Lee' );
        expect( screen.getByRole( 'region', { name: 'About' } ) ).toHaveTextContent( 'VisibilityPrivate' );
        expect( screen.getByRole( 'region', { name: 'About' } ) ).toHaveTextContent( 'SourceCommunity' );
    } );

    it( 'says when the path isn\'t available', async () => {
        api( PATH, { [`GET ${URL}`]: () => json( 404, { statusCode: 404, message: 'Not Found' } ) } );
        renderApp( `/app/catalog/${PATH.id}` );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'This path isn\'t available.' );
        expect( within( screen.getByRole( 'main' ) ).getByRole( 'link', { name: 'Browse paths' } ) ).toHaveAttribute( 'href', '/app/catalog' );
        expect( screen.queryByRole( 'button', { name: 'Try again' } ) ).not.toBeInTheDocument();
    } );

    it( 'says when loading failed, and tries again', async () => {
        let fail = true;

        api( PATH, {
            [`GET ${URL}`]: () => {
                const failed = fail;

                fail = false;

                return failed ? json( 500, {} ) : json( 200, PATH );
            },
        } );
        renderApp( `/app/catalog/${PATH.id}` );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Something went wrong while loading this path.' );
        await userEvent.setup().click( screen.getByRole( 'button', { name: 'Try again' } ) );
        expect( await screen.findByRole( 'heading', { level: 1 } ) ).toBeInTheDocument();
    } );

    it( 'says when StudyLog can\'t be reached, while loading first', async () => {
        mockApi( { ...loggedIn, [`GET ${URL}`]: pending } );
        const loading = renderApp( `/app/catalog/${PATH.id}` );

        expect( await screen.findByText( 'Loading the path…' ) ).toBeInTheDocument();
        loading.unmount();

        api( PATH, { [`GET ${URL}`]: () => Promise.reject( new TypeError( 'Failed to fetch' ) ) } );
        renderApp( `/app/catalog/${PATH.id}` );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'Can\'t reach StudyLog right now.' );
    } );
} );
