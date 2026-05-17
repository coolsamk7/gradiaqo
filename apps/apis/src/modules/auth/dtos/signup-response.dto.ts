import { UserAuthStatus } from '@gradiaqo/nestjs-shared';
import Type from 'typebox';

export const SignupResponse = Type.Object( {
    id: Type.String(),
    email: Type.String( { format: 'email' } ),
    firstName: Type.String( { minLength: 1 } ),
    lastName: Type.String( { minLength: 1 } ),
    authStatus: Type.Enum( UserAuthStatus ),
} );
