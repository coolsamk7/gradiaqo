import { catalogPath, uuid } from '../../test/fixtures.ts';
import { authorOf, count, formatEstimate, isSource, sourceOf } from './catalog-paths.ts';

const ME = uuid( 1 );
const alice = { id: uuid( 2 ), firstName: 'Alice', lastName: 'Walker' };
const team = { id: uuid( 3 ), name: 'Acme Study Group', isPersonal: false };
const workspace = { id: uuid( 4 ), name: 'Workspace', isPersonal: true };

describe( 'sourceOf and authorOf', () => {
    it( 'official paths come from StudyLog', () => {
        const path = catalogPath( 'DSA' );

        expect( sourceOf( path, ME ) ).toEqual( { label: 'Official', tone: 'accent' } );
        expect( authorOf( path, ME ) ).toBe( 'By StudyLog' );
    } );

    it( 'organization paths show the organization, and who made them if known', () => {
        expect( sourceOf( catalogPath( 'Sprint', { organization: team, createdBy: alice } ), ME ) ).toEqual( { label: 'Acme Study Group', tone: 'neutral' } );
        expect( authorOf( catalogPath( 'Sprint', { organization: team, createdBy: alice } ), ME ) ).toBe( 'Acme Study Group · by Alice Walker' );
        expect( authorOf( catalogPath( 'Sprint', { organization: team } ), ME ) ).toBe( 'Acme Study Group' );
    } );

    it( 'the user\'s own paths say so, with their visibility', () => {
        const mine = catalogPath( 'Picks', { organization: workspace, createdBy: { ...alice, id: ME }, visibility: 'private' as never } );

        expect( sourceOf( mine, ME ) ).toEqual( { label: 'Yours', tone: 'inverse' } );
        expect( authorOf( mine, ME ) ).toBe( 'Your workspace · private' );
    } );

    it( 'other people\'s public paths are community paths, by their author if known', () => {
        expect( sourceOf( catalogPath( 'Picks', { organization: workspace, createdBy: alice } ), ME ) ).toEqual( { label: 'Community', tone: 'warning' } );
        expect( authorOf( catalogPath( 'Picks', { organization: workspace, createdBy: alice } ), ME ) ).toBe( 'By Alice Walker' );
        // The author deleted their account.
        expect( sourceOf( catalogPath( 'Picks', { organization: workspace } ), ME ).label ).toBe( 'Community' );
        expect( authorOf( catalogPath( 'Picks', { organization: workspace } ), ME ) ).toBe( 'Community' );
    } );
} );

describe( 'formatEstimate', () => {
    it( 'shows minutes under an hour, then whole hours, and nothing without estimates', () => {
        expect( formatEstimate( 0 ) ).toBeUndefined();
        expect( formatEstimate( 45 ) ).toBe( '≈ 45m' );
        expect( formatEstimate( 90 ) ).toBe( '≈ 2h' );
        expect( formatEstimate( 962 ) ).toBe( '≈ 16h' );
    } );
} );

describe( 'helpers', () => {
    it( 'knows the filters and counts in words', () => {
        expect( isSource( 'community' ) ).toBe( true );
        expect( isSource( 'everything' ) ).toBe( false );
        expect( isSource( null ) ).toBe( false );
        expect( count( 1, 'module' ) ).toBe( '1 module' );
        expect( count( 4, 'module' ) ).toBe( '4 modules' );
    } );
} );
