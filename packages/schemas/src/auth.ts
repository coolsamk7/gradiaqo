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

// ---------- Email codes: verifying the email, resetting a forgotten password ----------

/** A 6-digit code from an email. Spaces are allowed (people copy "482 913"), and taken out. */
const EmailCode = () => Type.Codec(
    Type.String( { pattern: '^\\s*(\\d\\s*){6}$', errorMessage: 'must be the 6-digit code from the email', examples: [ '482913' ] } ),
).Decode( ( value ) => value.replace( /\s/g, '' ) ).Encode( ( value ) => value );

export const VerifyEmailRequest = Type.Object( { code: EmailCode() }, { additionalProperties: false } );
export type VerifyEmailRequest = StaticDecode<typeof VerifyEmailRequest>;

export const ForgotPasswordRequest = Type.Object( { email: Email() }, { additionalProperties: false } );
export type ForgotPasswordRequest = StaticDecode<typeof ForgotPasswordRequest>;

export const ResetPasswordRequest = Type.Object(
    {
        email: Email(),
        code: EmailCode(),
        newPassword: SignupRequest.properties.password,
    },
    { additionalProperties: false },
);
export type ResetPasswordRequest = StaticDecode<typeof ResetPasswordRequest>;
