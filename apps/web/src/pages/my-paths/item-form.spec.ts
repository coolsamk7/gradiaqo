import { Difficulty, ItemType } from '@studylog/schemas/enums';

import { checkItem, emptyItem, itemFieldErrors, platformOf, toItemRequest } from './item-form.ts';

describe( 'checkItem', () => {
    it( 'asks for a title and the details the type needs', () => {
        expect( checkItem( emptyItem() ) ).toEqual( { title: 'Enter a title.', url: 'Enter a link.' } );
        expect( checkItem( emptyItem( ItemType.Note ) ) ).toEqual( { title: 'Enter a title.', content: 'Enter the note.' } );
        expect( checkItem( emptyItem( ItemType.Exercise ) ) ).toEqual( {
            title: 'Enter a title.',
            instructions: 'Enter the instructions.',
        } );
        // A book needs nothing but its title.
        expect( checkItem( { ...emptyItem( ItemType.Book ), title: 'CLRS' } ) ).toEqual( {} );
    } );

    it( 'wants full web links, even optional ones', () => {
        expect( checkItem( { ...emptyItem(), title: 'Two Sum', url: 'leetcode.com/problems/two-sum' } ) )
            .toEqual( { url: 'Enter a full link, starting with https://' } );
        expect( checkItem( { ...emptyItem( ItemType.Book ), title: 'CLRS', url: 'mitpress' } ) )
            .toEqual( { url: 'Enter a full link, starting with https://' } );
        expect( checkItem( { ...emptyItem(), title: 'Two Sum', url: ' https://leetcode.com/problems/two-sum ' } ) ).toEqual( {} );
    } );

    it( 'wants whole minutes from 1 to 10,000', () => {
        const item = { ...emptyItem( ItemType.Note ), title: 'Cheat sheet', content: 'Patterns' };

        expect( checkItem( { ...item, minutes: '2.5' } ) ).toEqual( { minutes: 'Enter whole minutes, like 25.' } );
        expect( checkItem( { ...item, minutes: 'ten' } ) ).toEqual( { minutes: 'Enter whole minutes, like 25.' } );
        expect( checkItem( { ...item, minutes: '0' } ) ).toEqual( { minutes: 'Enter between 1 and 10,000 minutes.' } );
        expect( checkItem( { ...item, minutes: '10001' } ) ).toEqual( { minutes: 'Enter between 1 and 10,000 minutes.' } );
        expect( checkItem( { ...item, minutes: ' 25 ' } ) ).toEqual( {} );
    } );
} );

describe( 'toItemRequest', () => {
    it( 'sends the details of the chosen type only, trimmed, with the platform of a problem', () => {
        expect( toItemRequest( {
            ...emptyItem(),
            title: ' Merge Intervals ',
            url: 'https://leetcode.com/problems/merge-intervals/',
            author: 'left over from another type',
            difficulty: Difficulty.Medium,
            minutes: '25',
        } ) ).toEqual( {
            type: ItemType.Problem,
            title: 'Merge Intervals',
            details: { url: 'https://leetcode.com/problems/merge-intervals/', platform: 'leetcode' },
            difficulty: Difficulty.Medium,
            estimatedMinutes: 25,
        } );
    } );

    it( 'leaves out what is empty, and a difficulty where it doesn\'t apply', () => {
        expect( toItemRequest( { ...emptyItem( ItemType.Book ), title: 'CLRS', author: 'Cormen', difficulty: Difficulty.Hard } ) )
            .toEqual( { type: ItemType.Book, title: 'CLRS', details: { author: 'Cormen' } } );
        expect( toItemRequest( { ...emptyItem( ItemType.Exercise ), title: 'Reverse', instructions: 'Reverse a list', answer: ' ' } ) )
            .toEqual( { type: ItemType.Exercise, title: 'Reverse', details: { instructions: 'Reverse a list' } } );
        expect( toItemRequest( { ...emptyItem(), title: 'Local', url: 'https://localhost/x' } ).details )
            .toEqual( { url: 'https://localhost/x' } );
    } );
} );

describe( 'platformOf', () => {
    it( 'names the site from its address', () => {
        expect( platformOf( 'https://www.hackerrank.com/challenges/x' ) ).toBe( 'hackerrank' );
        expect( platformOf( 'https://localhost/x' ) ).toBeUndefined();
        expect( platformOf( 'not a link' ) ).toBeUndefined();
    } );
} );

describe( 'itemFieldErrors', () => {
    it( 'puts the API\'s messages on the form\'s fields', () => {
        expect( itemFieldErrors( {
            'details/url': 'must be an http(s) URL',
            estimatedMinutes: 'must be at least 1',
            title: 'must not be empty',
            tags: 'are not shown in this form',
        } ) ).toEqual( {
            url: 'Link must be an http(s) URL.',
            minutes: 'Minutes must be at least 1.',
            title: 'Title must not be empty.',
        } );
    } );
} );
