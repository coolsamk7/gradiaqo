import { ApiError } from '../api/client.ts';
import { describeApiError, emailError, focusFirstError } from './form-errors.ts';

const LABELS = { email: 'Email' };

describe( 'describeApiError', () => {
    it( 'has a generic message for anything that isn\'t an API or network error', () => {
        expect( describeApiError( new Error( 'bug' ), LABELS ) ).toEqual( { form: 'Something went wrong. Please try again.', fields: {} } );
    } );

    it.each( [
        [ 1, 'Try again in 1 second.' ],
        [ 59, 'Try again in 59 seconds.' ],
        [ 60, 'Try again in 1 minute.' ],
        [ 61, 'Try again in 2 minutes.' ],
        [ 3600, 'Try again in 60 minutes.' ],
    ] )( 'turns a wait of %i seconds into "%s"', ( seconds, wait ) => {
        expect( describeApiError( new ApiError( 429, 'Too many requests', { retryAfterSeconds: seconds } ), LABELS ).form ).toBe( `Too many attempts. ${wait}` );
    } );

    it( 'uses the form\'s own message for a status it knows, over the generic one', () => {
        expect( describeApiError( new ApiError( 429, 'Too many requests' ), LABELS, { 429: { form: 'Slow down.' } } ) )
            .toEqual( { form: 'Slow down.', fields: {} } );
        expect( describeApiError( new ApiError( 409, 'Conflict' ), LABELS, { 409: { field: 'email', message: 'Taken.' } } ) )
            .toEqual( { fields: { email: 'Taken.' } } );
    } );
} );

describe( 'emailError', () => {
    it.each( [ 'sam@example.com', '  sam@example.com  ' ] )( 'accepts "%s"', ( email ) => {
        expect( emailError( email ) ).toBeUndefined();
    } );

    it.each( [ 'sam smith@example.com', 'sam@example.com x', 'sam@example', '@example.com' ] )( 'rejects "%s"', ( email ) => {
        expect( emailError( email ) ).toBe( 'Enter a valid email, like name@example.com.' );
    } );

    it( 'asks for an email when there is only space', () => {
        expect( emailError( '   ' ) ).toBe( 'Enter your email.' );
    } );
} );

describe( 'focusFirstError', () => {
    it( 'does nothing without errors', () => {
        document.body.innerHTML = '<input id="email">';

        focusFirstError( [ 'email' ], {} );

        expect( document.body ).toHaveFocus();
    } );
} );
