import { UserAuthStatus } from '@gradiaqo/nestjs-shared';
import Type from 'typebox';

export const VerifyOtpRequest = Type.Object( {
    userId: Type.String( { minLength: 1 } ),
    otp: Type.String( {
        minLength: 6,
        maxLength: 6,
        pattern: '^[0-9]{6}$',
    } ),
} );

export const VerifyOtpResponse = Type.Object( {
    id: Type.String(),
    email: Type.String( { format: 'email' } ),
    firstName: Type.String( { minLength: 1 } ),
    lastName: Type.String( { minLength: 1 } ),
    authStatus: Type.Enum( UserAuthStatus ),
} );
