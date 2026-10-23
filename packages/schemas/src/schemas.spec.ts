import type { Validator } from 'typebox/compile';
import { Compile } from 'typebox/compile';
import { describe, expect, it } from 'vitest';

import {
    CreateItemRequest,
    CreateLearningPathRequest,
    Email,
    ForgotPasswordRequest,
    IsoDate,
    ItemDetailsSchemas,
    ItemProgress,
    ItemType,
    LoginRequest,
    NullableIsoDate,
    ReorderRequest,
    ResetPasswordRequest,
    SignupRequest,
    StudySessionPage,
    TrimmedText,
    UpdateOrganizationRequest,
    User,
    VerifyEmailRequest,
} from './index.js';

const parse = ( validator: Validator ) => ( value: unknown ) =>
    ( validator.Check( value ) ? validator.Decode( value ) : undefined );

describe( 'request schemas', () => {
    const signup = parse( Compile( SignupRequest ) );

    it( 'trims names and trims + lowercases emails', () => {
        expect( signup( { email: '  Sam@Example.COM ', firstName: '  Sam ', lastName: 'K', password: 'supersecret1' } ) )
            .toEqual( { email: 'sam@example.com', firstName: 'Sam', lastName: 'K', password: 'supersecret1' } );
    } );

    it( 'rejects invalid emails, blank names, short passwords and unknown fields', () => {
        const valid = { email: 'a@b.co', firstName: 'A', lastName: 'B', password: 'supersecret1' };

        expect( signup( { ...valid, email: 'not-an-email' } ) ).toBeUndefined();
        expect( signup( { ...valid, email: 'a b@c.co' } ) ).toBeUndefined();
        expect( signup( { ...valid, firstName: '   ' } ) ).toBeUndefined();
        expect( signup( { ...valid, firstName: 'x'.repeat( 101 ) } ) ).toBeUndefined();
        expect( signup( { ...valid, password: 'short' } ) ).toBeUndefined();
        expect( signup( { ...valid, platformRole: 'superadmin' } ) ).toBeUndefined();
        expect( signup( valid ) ).toBeDefined();
    } );

    it( 'normalizes login emails the same way', () => {
        expect( parse( Compile( LoginRequest ) )( { email: ' A@B.CO', password: 'x' } ) ).toEqual( { email: 'a@b.co', password: 'x' } );
    } );

    it( 'trims organization names', () => {
        expect( parse( Compile( UpdateOrganizationRequest ) )( { name: '  Group  ' } ) ).toEqual( { name: 'Group' } );
    } );
} );

describe( 'response schemas', () => {
    it( 'encode dates to ISO strings and only allow known roles', () => {
        const user = Compile( User );
        const createdAt = new Date( '2026-01-02T03:04:05.000Z' );
        const encoded = user.Encode( {
            id: '97f12719-9f4c-41c9-afc3-a91de613d02b', email: 'a@b.co', firstName: 'A', lastName: 'B',
            platformRole: 'application_user', emailVerifiedAt: null, createdAt, updatedAt: createdAt,
        } );

        expect( encoded.createdAt ).toBe( '2026-01-02T03:04:05.000Z' );
        expect( encoded.emailVerifiedAt ).toBeNull();
        expect( user.Check( { ...encoded, platformRole: 'god' } ) ).toBe( false );
    } );

    it( 'take the 6-digit code from an email, with or without spaces', () => {
        const verify = Compile( VerifyEmailRequest );

        expect( verify.Decode( { code: ' 482 913 ' } ) ).toEqual( { code: '482913' } );
        expect( verify.Encode( { code: '482913' } ) ).toEqual( { code: '482913' } );
        expect( verify.Check( { code: '48291' } ) ).toBe( false );
        expect( verify.Check( { code: '482a13' } ) ).toBe( false );
        expect( Compile( ResetPasswordRequest ).Check( { email: 'a@b.co', code: '482913', newPassword: 'short' } ) ).toBe( false );
        expect( Compile( ForgotPasswordRequest ).Check( { email: 'not-an-email' } ) ).toBe( false );
    } );

    it( 'encode nullable dates whether set or null', () => {
        const progress = Compile( ItemProgress );
        const at = new Date( '2026-01-02T03:04:05.000Z' );
        const encoded = progress.Encode( {
            itemId: '97f12719-9f4c-41c9-afc3-a91de613d02b', status: 'in_progress', startedAt: at, completedAt: null, updatedAt: at,
        } );

        expect( encoded ).toMatchObject( { startedAt: '2026-01-02T03:04:05.000Z', completedAt: null } );
    } );
} );

describe( 'catalog schemas', () => {
    const createPath = parse( Compile( CreateLearningPathRequest ) );

    it( 'trims titles and accepts only lowercase dashed slugs', () => {
        expect( createPath( { title: '  DSA ', slug: 'dsa-101' } ) ).toEqual( { title: 'DSA', slug: 'dsa-101' } );
        expect( createPath( { title: 'DSA', slug: 'DSA' } ) ).toBeUndefined();
        expect( createPath( { title: 'DSA', slug: 'dsa--101' } ) ).toBeUndefined();
        expect( createPath( { title: 'DSA', slug: '-dsa' } ) ).toBeUndefined();
        expect( createPath( { title: '   ' } ) ).toBeUndefined();
        expect( createPath( { title: 'DSA', status: 'live' } ) ).toBeUndefined();
    } );

    it( 'accepts any details object when creating an item (checked per type by the API)', () => {
        const createItem = parse( Compile( CreateItemRequest ) );

        expect( createItem( { type: 'problem', title: 'Two Sum', details: { anything: 1 } } ) ).toBeDefined();
        expect( createItem( { type: 'podcast', title: 'Two Sum', details: {} } ) ).toBeUndefined();
        expect( createItem( { type: 'problem', title: 'Two Sum' } ) ).toBeUndefined();
    } );

    it( 'has a details schema per item type that rejects unknown fields and non-http URLs', () => {
        const problem = Compile( ItemDetailsSchemas[ItemType.Problem] );
        const note = Compile( ItemDetailsSchemas[ItemType.Note] );
        const book = Compile( ItemDetailsSchemas[ItemType.Book] );

        expect( Object.keys( ItemDetailsSchemas ).sort() ).toEqual( Object.values( ItemType ).sort() );
        expect( problem.Check( { url: 'https://leetcode.com/problems/two-sum', platform: 'leetcode' } ) ).toBe( true );
        expect( problem.Check( { url: 'javascript:alert(1)' } ) ).toBe( false );
        expect( problem.Check( { url: 'https://a.co', extra: true } ) ).toBe( false );
        expect( problem.Check( {} ) ).toBe( false );
        expect( note.Check( { content: '' } ) ).toBe( false );
        expect( book.Check( {} ) ).toBe( true );
    } );

    it( 'rejects duplicate ids in a reorder', () => {
        const reorder = parse( Compile( ReorderRequest ) );
        const id = '97f12719-9f4c-41c9-afc3-a91de613d02b';

        expect( reorder( { ids: [ id ] } ) ).toEqual( { ids: [ id ] } );
        expect( reorder( { ids: [ id, id ] } ) ).toBeUndefined();
        expect( reorder( { ids: [ 'not-a-uuid' ] } ) ).toBeUndefined();
    } );
} );

describe( 'primitives', () => {
    const at = new Date( '2026-01-02T03:04:05.000Z' );

    it( 'IsoDate decodes to a Date and encodes back', () => {
        const date = Compile( IsoDate() );

        expect( date.Decode( '2026-01-02T03:04:05.000Z' ) ).toEqual( at );
        expect( date.Encode( at ) ).toBe( '2026-01-02T03:04:05.000Z' );
    } );

    it( 'NullableIsoDate handles both a date and null, in both directions', () => {
        const date = Compile( NullableIsoDate() );

        expect( date.Decode( '2026-01-02T03:04:05.000Z' ) ).toEqual( at );
        expect( date.Decode( null ) ).toBeNull();
        expect( date.Encode( null ) ).toBeNull();
    } );

    it( 'Email and TrimmedText send values back unchanged', () => {
        expect( Compile( Email() ).Encode( 'a@b.co' ) ).toBe( 'a@b.co' );
        expect( Compile( TrimmedText( 10 ) ).Encode( 'text' ) ).toBe( 'text' );
    } );
} );

describe( 'response schemas', () => {
    it( 'StudySessionPage keeps only the titles of a session\'s topic and item', () => {
        const id = '97f12719-9f4c-41c9-afc3-a91de613d02b';
        const date = new Date( '2026-09-28T10:00:00Z' );
        const dates = { startedAt: date, createdAt: date, updatedAt: date };
        const session = { id, topicId: id, itemId: null, durationMinutes: 45, notes: null, ...dates };
        const page = Compile( StudySessionPage ).Clean( {
            total: 1,
            items: [ { ...session, userId: 'secret', topic: { id, title: 'Two Pointers', slug: 'two-pointers' }, item: null } ],
        } );

        expect( page ).toEqual( { total: 1, items: [ { ...session, topic: { id, title: 'Two Pointers' }, item: null } ] } );
    } );
} );
