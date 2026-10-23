import type { ClipboardEvent, KeyboardEvent } from 'react';
import { useEffect, useRef } from 'react';

import styles from './CodeInput.module.css';

export const CODE_LENGTH = 6;

interface CodeInputProps {
    /** The digits typed so far (up to 6). */
    value: string;
    onChange: ( value: string ) => void;
    /** Names the group for screen readers, e.g. "Verification code". */
    label: string;
    invalid?: boolean;
    /** Ids of the hint or error text that describe it. */
    describedBy?: string;
    autoFocus?: boolean;
    disabled?: boolean;
}

/**
 * A 6-digit code in six boxes (Figma: Verify email › Code). Typing moves to the next box, Backspace to the
 * previous one, and pasting "482 913" fills them all.
 */
export function CodeInput( props: CodeInputProps ) {
    const { value, onChange, label, invalid = false, describedBy, autoFocus = false, disabled = false } = props;
    const boxes = useRef<( HTMLInputElement | null )[]>( [] );
    // The code as of the last change, which focus handlers see before the next render.
    const latest = useRef( value );
    const digits = Array.from( { length: CODE_LENGTH }, ( _, index ) => value[index] ?? '' );

    const focus = ( index: number ) => boxes.current[Math.min( Math.max( index, 0 ), CODE_LENGTH - 1 )]?.focus();

    useEffect( () => {
        latest.current = value;
    }, [ value ] );

    const change = ( next: string ) => {
        latest.current = next;
        onChange( next );
    };

    /** Writes `typed` (digits only) over the boxes from `index` on, then moves past it. */
    const fill = ( index: number, typed: string ) => {
        const added = typed.replace( /\D/g, '' );

        if ( !added ) {
            return;
        }

        change( ( value.slice( 0, index ) + added + value.slice( index + added.length ) ).slice( 0, CODE_LENGTH ) );
        focus( index + added.length );
    };

    const onKeyDown = ( index: number, event: KeyboardEvent<HTMLInputElement> ) => {
        if ( event.key === 'Backspace' && !digits[index] ) {
            event.preventDefault();
            change( value.slice( 0, index - 1 ) );
            focus( index - 1 );
        }
    };

    const onPaste = ( index: number, event: ClipboardEvent<HTMLInputElement> ) => {
        event.preventDefault();
        fill( index, event.clipboardData.getData( 'text' ) );
    };

    return (
        <div className={styles.code} role="group" aria-label={label} aria-describedby={describedBy}>
            {digits.map( ( digit, index ) => (
                <input
                    // The boxes never change places.
                    key={index}
                    ref={( element ) => {
                        boxes.current[index] = element;
                    }}
                    className={styles.box}
                    aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
                    aria-invalid={invalid || undefined}
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    autoFocus={autoFocus && index === 0}
                    disabled={disabled}
                    value={digit}
                    onChange={( event ) => {
                        if ( event.target.value === '' ) {
                            change( value.slice( 0, index ) + value.slice( index + 1 ) );
                        } else {
                            fill( index, event.target.value.slice( digit ? 1 : 0 ) );
                        }
                    }}
                    onKeyDown={( event ) => onKeyDown( index, event )}
                    onPaste={( event ) => onPaste( index, event )}
                    // Typing into a later box than the code reaches continues where it ends.
                    onFocus={() => index > latest.current.length && focus( latest.current.length )}
                />
            ) )}
        </div>
    );
}
