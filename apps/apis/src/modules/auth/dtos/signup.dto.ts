import Type from 'typebox';

export const SignupRequest = Type.Object( { 
    email: Type.String( { format: 'email' } ),
    password: Type.String( { minLength: 8 } ),
    firstName: Type.String( { minLength: 1 } ),
    lastName: Type.String( { minLength: 1 } )
} );
