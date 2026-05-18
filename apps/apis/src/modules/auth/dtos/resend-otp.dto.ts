import Type from 'typebox';

export const ResendOtpRequest = Type.Object( {
    userId: Type.String( { minLength: 1 } ),
} );
