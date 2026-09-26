import { describeLoginError } from './login-errors.ts';

describe( 'describeLoginError', () => {
    it( 'has a generic message for anything that isn\'t an API or network error', () => {
        expect( describeLoginError( new Error( 'bug' ) ) ).toEqual( { form: 'Something went wrong. Please try again.', fields: {} } );
    } );
} );
