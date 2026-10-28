import { render, screen } from '@testing-library/react';

import { Markdown } from './Markdown.tsx';

describe( 'Markdown', () => {
    it( 'formats text, lists and tables, with links opening in a new tab', () => {
        const { container } = render(
            <Markdown
                className="extra"
                text={[
                    'Read **this** first, then `code`.',
                    '',
                    '- one',
                    '- two',
                    '',
                    '**Resource:** [python.org](https://python.org)',
                    '',
                    '| Need | Use |',
                    '|---|---|',
                    '| Search | Postgres |',
                ].join( '\n' )}
            />,
        );

        expect( container.firstElementChild ).toHaveClass( 'extra' );
        expect( screen.getByText( 'this' ).tagName ).toBe( 'STRONG' );
        expect( screen.getByText( 'code' ).tagName ).toBe( 'CODE' );
        expect( screen.getAllByRole( 'listitem' ).map( ( item ) => item.textContent ) ).toEqual( [ 'one', 'two' ] );
        expect( screen.getByRole( 'link', { name: 'python.org' } ) ).toHaveAttribute( 'href', 'https://python.org' );
        expect( screen.getByRole( 'link', { name: 'python.org' } ) ).toHaveAttribute( 'target', '_blank' );
        expect( screen.getByRole( 'link', { name: 'python.org' } ) ).toHaveAttribute( 'rel', 'noopener noreferrer' );
        expect( screen.getByRole( 'table' ) ).toHaveTextContent( 'NeedUseSearchPostgres' );
    } );

    it( 'keeps line breaks of text typed in the app', () => {
        const { container } = render( <Markdown text={'Start with a dummy node.\nReturn dummy.next.'} /> );

        expect( container.querySelector( 'br' ) ).not.toBeNull();
        expect( container.firstElementChild?.className ).not.toMatch( /\s$/ );
    } );

    it( 'never renders HTML, and drops unsafe links', () => {
        const { container } = render( <Markdown text={'<img src="x" onerror="alert(1)"> [click](javascript:alert(1))'} /> );

        expect( container.querySelector( 'img' ) ).toBeNull();
        expect( container ).toHaveTextContent( '<img src="x" onerror="alert(1)">' );
        expect( screen.getByText( 'click' ) ).not.toHaveAttribute( 'href', expect.stringContaining( 'javascript' ) );
    } );
} );
