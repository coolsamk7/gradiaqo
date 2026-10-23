import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { ApiError, NetworkError } from '../api/client.ts';
import { describeCodeError, formatCountdown } from './code-errors.ts';
import { CodeInput } from './CodeInput.tsx';

/** The input with its value kept in state, and shown for checking. */
function Harness( { initial = '' }: { initial?: string } ) {
    const [ value, setValue ] = useState( initial );

    return (
        <>
            <CodeInput value={value} onChange={setValue} label="Verification code" describedBy="hint" autoFocus />
            <output>{value}</output>
        </>
    );
}

const box = ( n: number ) => screen.getByRole( 'textbox', { name: `Digit ${n} of 6` } );

describe( 'CodeInput', () => {
    it( 'moves to the next box while typing, and skips letters', async () => {
        render( <Harness /> );
        const user = userEvent.setup();

        expect( screen.getByRole( 'group', { name: 'Verification code' } ) ).toHaveAttribute( 'aria-describedby', 'hint' );
        expect( box( 1 ) ).toHaveFocus();
        expect( box( 1 ) ).toHaveAttribute( 'autocomplete', 'one-time-code' );

        await user.keyboard( '4a82' );
        expect( screen.getByRole( 'status' ) ).toHaveTextContent( '482' );
        expect( box( 4 ) ).toHaveFocus();

        await user.keyboard( '913' );
        expect( screen.getByRole( 'status' ) ).toHaveTextContent( /^482913$/ );
        expect( box( 6 ) ).toHaveFocus();

        // One more replaces the last digit.
        await user.keyboard( '7' );
        expect( screen.getByRole( 'status' ) ).toHaveTextContent( /^482917$/ );
    } );

    it( 'goes back with Backspace', async () => {
        render( <Harness initial="482" /> );
        const user = userEvent.setup();

        await user.click( box( 4 ) );
        await user.keyboard( '{Backspace}' );
        expect( screen.getByRole( 'status' ) ).toHaveTextContent( /^48$/ );
        expect( box( 3 ) ).toHaveFocus();

        await user.keyboard( '{Backspace}' );
        expect( screen.getByRole( 'status' ) ).toHaveTextContent( /^4$/ );
    } );

    it( 'replaces a digit typed over, and clears one that is deleted', async () => {
        render( <Harness initial="482913" /> );
        const user = userEvent.setup();

        await user.click( box( 2 ) );
        await user.keyboard( '{Backspace}' );
        expect( screen.getByRole( 'status' ) ).toHaveTextContent( /^42913$/ );

        // Typing over the first digit replaces just that one.
        fireEvent.change( box( 1 ), { target: { value: '47' } } );
        expect( screen.getByRole( 'status' ) ).toHaveTextContent( /^72913$/ );
    } );

    it( 'fills every box from a pasted code', async () => {
        render( <Harness /> );
        const user = userEvent.setup();

        await user.click( box( 1 ) );
        await user.paste( '482 913' );
        expect( screen.getByRole( 'status' ) ).toHaveTextContent( /^482913$/ );

        // Nothing usable in the clipboard: nothing changes.
        await user.click( box( 6 ) );
        await user.paste( 'abc' );
        expect( screen.getByRole( 'status' ) ).toHaveTextContent( /^482913$/ );
    } );

    it( 'continues where the code ends when a later box is clicked', async () => {
        render( <Harness initial="48" /> );

        await userEvent.setup().click( box( 5 ) );

        expect( box( 3 ) ).toHaveFocus();
    } );

    it( 'can be marked wrong, and disabled', () => {
        render( <CodeInput value="" onChange={() => undefined} label="Code" invalid disabled /> );

        expect( box( 1 ) ).toHaveAttribute( 'aria-invalid', 'true' );
        expect( box( 1 ) ).toBeDisabled();
    } );
} );

describe( 'code errors', () => {
    it( 'shows the API\'s messages about codes, and plain ones otherwise', () => {
        expect( describeCodeError( new NetworkError() ) ).toMatch( /^Can't reach StudyLog/ );
        expect( describeCodeError( new ApiError( 400, 'That code is wrong or has expired.' ) ) ).toBe( 'That code is wrong or has expired.' );
        expect( describeCodeError( new ApiError( 429, 'Wait a minute.' ) ) ).toBe( 'Wait a minute.' );
        expect( describeCodeError( new ApiError( 400, 'Bad Request', { fieldErrors: { code: 'must be the 6-digit code' } } ) ) )
            .toBe( 'Enter the 6-digit code from the email.' );
        expect( describeCodeError( new ApiError( 500, 'Internal' ) ) ).toBe( 'Something went wrong. Please try again.' );
    } );

    it( 'writes a countdown', () => {
        expect( [ formatCountdown( 60 ), formatCountdown( 42 ), formatCountdown( 5 ) ] ).toEqual( [ '1:00', '0:42', '0:05' ] );
    } );
} );
