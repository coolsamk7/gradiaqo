import { validate } from './signup-errors.ts';

describe( 'validate', () => {
    it( 'measures the email without surrounding spaces', () => {
        const email = `  ${'a'.repeat( 243 )}@example.com  `;

        expect( validate( { firstName: 'Sam', lastName: 'Khan', email, password: 'supersecret1' } ) ).toEqual( {} );
    } );
} );
