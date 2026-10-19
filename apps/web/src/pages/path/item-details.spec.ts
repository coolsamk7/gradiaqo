import { ItemType } from '@studylog/schemas/enums';

import { itemContent, itemFacts, itemLink } from './item-details.ts';

describe( 'itemLink', () => {
    it( 'links to where the item lives, naming the platform when known', () => {
        expect( itemLink( { url: 'https://leetcode.com/problems/two-sum/', platform: 'leetcode' } ) )
            .toEqual( { url: 'https://leetcode.com/problems/two-sum/', label: 'Open on leetcode' } );
        expect( itemLink( { url: 'https://example.com/article' } ) ).toEqual( { url: 'https://example.com/article', label: 'Open' } );
        expect( itemLink( { url: 'https://example.com/article', platform: '' } )?.label ).toBe( 'Open' );
    } );

    it( 'has no link without a URL', () => {
        expect( itemLink( {} ) ).toBeUndefined();
        expect( itemLink( { url: '' } ) ).toBeUndefined();
        expect( itemLink( { url: 42 } ) ).toBeUndefined();
    } );
} );

describe( 'itemContent', () => {
    it( 'shows a note\'s text', () => {
        expect( itemContent( ItemType.Note, { content: 'Use a dummy head.' } ) ).toEqual( { body: 'Use a dummy head.' } );
        expect( itemContent( ItemType.Note, {} ) ).toBeUndefined();
    } );

    it( 'shows an exercise\'s instructions, with the answer when there is one', () => {
        expect( itemContent( ItemType.Exercise, { instructions: 'Do it.', answer: 'Like this.' } ) )
            .toEqual( { body: 'Do it.', answer: 'Like this.' } );
        expect( itemContent( ItemType.Exercise, { instructions: 'Do it.' } ) ).toEqual( { body: 'Do it.', answer: undefined } );
        expect( itemContent( ItemType.Exercise, { answer: 'Like this.' } ) ).toBeUndefined();
    } );

    it( 'has nothing to show for items studied elsewhere', () => {
        expect( itemContent( ItemType.Problem, { content: 'x', instructions: 'y' } ) ).toBeUndefined();
    } );
} );

describe( 'itemFacts', () => {
    it( 'lists a book\'s author and chapters, and a course\'s provider', () => {
        expect( itemFacts( { author: 'Cormen et al.', chapters: 'Ch. 12', isbn: '123' } ) ).toEqual( [ 'Cormen et al.', 'Ch. 12' ] );
        expect( itemFacts( { url: 'https://x.dev', provider: 'MIT' } ) ).toEqual( [ 'MIT' ] );
        expect( itemFacts( { author: '' } ) ).toEqual( [] );
    } );
} );
