import { Difficulty, ItemType } from '@studylog/schemas/enums';
import { describe, expect, it } from 'vitest';

import { CatalogFileError, itemKey, parseCatalogFile } from './catalog-file.js';

const PATH = `
slug: dsa
title: Data Structures & Algorithms
description: From arrays to dynamic programming.
modules:
  - title: Arrays & Hashing
    description: The basics.
    topics:
      - title: Hashing Basics
        slug: hashing
        description: Use a hash map to look things up in O(1).
        items:
          - leetcode: two-sum
            title: Two Sum
            difficulty: easy
            minutes: 20
            tags: [arrays, hashing]
          - type: video
            title: Hash maps explained
            url: https://example.com/video
            durationMinutes: 12
            optional: true
          - type: note
            title: When to use a hash map
            content: Counting and grouping.
`;

/** The YAML for a file with one module and one topic holding `items` (an indented YAML list). */
const withItems = ( items: string ) => `
slug: x
title: X
modules:
  - title: M
    topics:
      - title: T
        items:
${items}`;

describe( 'parseCatalogFile', () => {
    it( 'reads a path, its modules, topics and items, filling in slugs and LeetCode links', () => {
        const path = parseCatalogFile( PATH );

        expect( path ).toMatchObject( { slug: 'dsa', title: 'Data Structures & Algorithms', description: 'From arrays to dynamic programming.' } );
        expect( path.modules[0] ).toMatchObject( { slug: 'arrays-hashing', title: 'Arrays & Hashing', description: 'The basics.' } );
        expect( path.modules[0].topics[0] ).toMatchObject( { slug: 'hashing', description: 'Use a hash map to look things up in O(1).' } );
        expect( path.modules[0].topics[0].items ).toEqual( [
            {
                type: ItemType.Problem,
                title: 'Two Sum',
                description: null,
                difficulty: Difficulty.Easy,
                estimatedMinutes: 20,
                tags: [ 'arrays', 'hashing' ],
                details: { url: 'https://leetcode.com/problems/two-sum/', platform: 'leetcode' },
                isOptional: false,
            },
            {
                type: ItemType.Video,
                title: 'Hash maps explained',
                description: null,
                difficulty: null,
                estimatedMinutes: null,
                tags: [],
                details: { url: 'https://example.com/video', durationMinutes: 12 },
                isOptional: true,
            },
            expect.objectContaining( { type: ItemType.Note, details: { content: 'Counting and grouping.' } } ),
        ] );
    } );

    it( 'leaves out descriptions that aren\'t there', () => {
        const path = parseCatalogFile( withItems( '          - type: note\n            title: N\n            content: C\n            description: D\n' ) );

        expect( path.description ).toBeNull();
        expect( path.modules[0].description ).toBeNull();
        expect( path.modules[0].topics[0].description ).toBeNull();
        expect( path.modules[0].topics[0].items[0].description ).toBe( 'D' );
    } );

    it( 'refuses text that isn\'t YAML', () => {
        expect( () => parseCatalogFile( 'a: [1,' ) ).toThrow( /^Not valid YAML: / );
        expect( () => parseCatalogFile( 'a: [1,' ) ).toThrow( CatalogFileError );
    } );

    it( 'lists every place the file doesn\'t match the format', () => {
        const problems = () => parseCatalogFile( 'slug: Bad Slug\ntitle: x\nmodules: []\nextra: 1\n' );

        expect( problems ).toThrow( /^The file doesn't match the format:\n {2}\// );
        expect( problems ).toThrow( '\n  /slug: must match pattern' );
        expect( problems ).toThrow( '\n  /modules: must not have fewer than 1 items' );
        expect( () => parseCatalogFile( 'just text' ) ).toThrow( 'The file doesn\'t match the format:\n  /: must be object' );
    } );

    it( 'lists every problem with the items, saying where each is', () => {
        const file = `
slug: x
title: X
modules:
  - title: M
    topics:
      - title: T
        items:
          - title: No type
          - type: video
            title: No URL
          - leetcode: two-sum
            title: Two Sum
            author: Someone
          - leetcode: two-sum
            type: video
            title: Two Sum again
      - title: T
        items:
          - type: article
            title: Bad URL
            url: not-a-url
  - title: M
    topics:
      - title: T
        items:
          - type: note
            title: N
            content: C
`;

        expect( () => parseCatalogFile( file ) ).toThrow( [
            'The file has problems:',
            '  modules[0].topics[0].items[0] ("No type"): needs a type, or leetcode for a LeetCode problem',
            '  modules[0].topics[0].items[1] ("No URL"): details must have required properties url',
            '  modules[0].topics[0].items[2] ("Two Sum"): author isn\'t used by a problem',
            '  modules[0].topics[0].items[3] ("Two Sum again"): leetcode items are problems, not video',
            '  modules[0].topics[0] items: "problem https://leetcode.com/problems/two-sum/" is used twice',
            '  modules[0].topics[1].items[0] ("Bad URL"): /url must match pattern "^https?://\\S+$"',
            '  modules[0] topic slugs: "t" is used twice',
            '  module slugs: "m" is used twice',
        ].join( '\n' ) );
    } );

    it( 'puts each type\'s own fields in its details', () => {
        const path = parseCatalogFile( withItems( `
          - type: article
            title: A
            url: https://a.example
          - type: book
            title: B
            author: Cormen
            chapters: Ch. 2
            isbn: '123'
            url: https://b.example
          - type: course
            title: C
            url: https://c.example
            provider: Coursera
          - type: exercise
            title: E
            instructions: Do it.
            answer: Done.
          - type: problem
            title: P
            url: https://p.example
            platform: hackerrank
` ) );

        expect( path.modules[0].topics[0].items.map( ( item ) => item.details ) ).toEqual( [
            { url: 'https://a.example' },
            { author: 'Cormen', chapters: 'Ch. 2', isbn: '123', url: 'https://b.example' },
            { url: 'https://c.example', provider: 'Coursera' },
            { instructions: 'Do it.', answer: 'Done.' },
            { url: 'https://p.example', platform: 'hackerrank' },
        ] );
    } );

    it( 'refuses unknown keys and empty titles at every level', () => {
        const fails = ( text: string, problem: string ) => expect( () => parseCatalogFile( text ) ).toThrow( problem );

        fails( withItems( '          - type: note\n            title: N\n            content: C\n            colour: red\n' ), '/modules/0/topics/0/items/0/colour' );
        fails( withItems( '          - type: note\n            title: ""\n            content: C\n' ), '/modules/0/topics/0/items/0/title' );
        fails( 'slug: x\ntitle: X\nmodules:\n  - title: M\n    colour: red\n    topics:\n      - title: T\n        items: [ { type: note, title: N, content: C } ]\n', '/modules/0/colour' );
        fails( 'slug: x\ntitle: X\nmodules:\n  - title: M\n    topics:\n      - title: T\n        colour: red\n        items: [ { type: note, title: N, content: C } ]\n', '/modules/0/topics/0/colour' );
        fails( 'slug: x\ntitle: ""\nmodules: []\n', '/title' );
    } );

    it( 'keeps the YAML error as the cause', () => {
        expect.assertions( 1 );
        try {
            parseCatalogFile( 'a: [1,' );
        } catch ( error ) {
            expect( ( error as Error ).cause ).toBeInstanceOf( Error );
        }
    } );

    it( 'takes a problem written out in full', () => {
        const path = parseCatalogFile( withItems( '          - type: problem\n            leetcode: two-sum\n            title: Two Sum\n' ) );

        expect( path.modules[0].topics[0].items[0].type ).toBe( ItemType.Problem );
    } );
} );

describe( 'itemKey', () => {
    it( 'is the type and URL, or the type and title for items without a URL', () => {
        expect( itemKey( { type: ItemType.Video, title: 'V', details: { url: 'https://v' } } ) ).toBe( 'video https://v' );
        expect( itemKey( { type: ItemType.Note, title: 'N', details: { content: 'c' } } ) ).toBe( 'note "N"' );
    } );
} );
