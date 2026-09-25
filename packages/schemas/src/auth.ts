import type { StaticDecode, StaticEncode } from 'typebox';
import Type from 'typebox';

import { Email, TrimmedText } from './primitives.js';
import { User } from './users.js';

export const SignupRequest = Type.Object(
    {
        email: Email(),
        firstName: TrimmedText( 100, [ 'Sameer' ] ),
        lastName: TrimmedText( 100, [ 'Khandke' ] ),
        password: Type.String( { minLength: 8, maxLength: 128, examples: [ 'supersecret1' ] } ),
    },
    { additionalProperties: false },
);
export type SignupRequest = StaticDecode<typeof SignupRequest>;

export const LoginRequest = Type.Object(
    {
        email: Email(),
        password: Type.String( { minLength: 1, maxLength: 128, examples: [ 'supersecret1' ] } ),
    },
    { additionalProperties: false },
);
export type LoginRequest = StaticDecode<typeof LoginRequest>;

export const AccessTokenResponse = Type.Object( {
    accessToken: Type.String( { description: 'JWT to send as `Authorization: Bearer <token>`. Expires after 15 minutes.' } ),
} );
export type AccessTokenResponse = StaticEncode<typeof AccessTokenResponse>;

export const AuthResponse = Type.Object( {
    accessToken: AccessTokenResponse.properties.accessToken,
    user: User,
} );
export type AuthResponse = StaticEncode<typeof AuthResponse>;
