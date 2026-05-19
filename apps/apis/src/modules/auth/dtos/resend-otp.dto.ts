import Type from 'typebox';

export const ResendOtpRequest = Type.Object( {
    userId: Type.String( { minLength: 1 } ),
    email: Type.String( { format: 'email' } ),
} );

export const ResendOtpResponse = Type.Object( {
    accepted: Type.Literal( true ),
} );
