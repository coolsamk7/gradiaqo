import type { StaticDecode, StaticEncode } from 'typebox';
import Type from 'typebox';

import { PlatformRole } from './enums.js';
import { IsoDate, NullableIsoDate, TrimmedText, Uuid } from './primitives.js';

/** A user as returned by the API. Never includes the password hash. */
export const User = Type.Object( {
    id: Uuid(),
    email: Type.String( { examples: [ 'sameer@example.com' ] } ),
    firstName: Type.String( { examples: [ 'Sameer' ] } ),
    lastName: Type.String( { examples: [ 'Khandke' ] } ),
    platformRole: Type.Enum( PlatformRole ),
    emailVerifiedAt: NullableIsoDate( { description: 'When the user confirmed their email with a code; null until then' } ),
    createdAt: IsoDate(),
    updatedAt: IsoDate(),
} );
/** As used in code (dates are `Date`). */
export type User = StaticDecode<typeof User>;
/** As sent over HTTP (dates are ISO strings), e.g. what the frontend receives. */
export type UserJson = StaticEncode<typeof User>;

export const UpdateProfileRequest = Type.Object(
    {
        firstName: Type.Optional( TrimmedText( 100, [ 'Sameer' ] ) ),
        lastName: Type.Optional( TrimmedText( 100, [ 'Khandke' ] ) ),
    },
    { additionalProperties: false },
);
export type UpdateProfileRequest = StaticDecode<typeof UpdateProfileRequest>;

const NewPassword = () => Type.String( { minLength: 8, maxLength: 128, examples: [ 'supersecret2' ] } );

export const ChangePasswordRequest = Type.Object(
    {
        currentPassword: Type.String( { minLength: 1, maxLength: 128 } ),
        newPassword: NewPassword(),
    },
    { additionalProperties: false },
);
export type ChangePasswordRequest = StaticDecode<typeof ChangePasswordRequest>;

export const DeleteAccountRequest = Type.Object(
    { password: Type.String( { minLength: 1, maxLength: 128, description: 'Your current password, to confirm' } ) },
    { additionalProperties: false },
);
export type DeleteAccountRequest = StaticDecode<typeof DeleteAccountRequest>;

// ---------- Admin › Users (superadmins only) ----------

/** A user as superadmins see them: the account plus when they last used the app. */
export const AdminUser = Type.Object( {
    ...User.properties,
    lastActiveAt: NullableIsoDate( { description: 'Last login or token renewal; null if they haven\'t logged in since it was tracked' } ),
} );
export type AdminUser = StaticDecode<typeof AdminUser>;
export type AdminUserJson = StaticEncode<typeof AdminUser>;

export const ListUsersQuery = Type.Object(
    {
        search: Type.Optional( Type.String( { minLength: 1, maxLength: 255, description: 'Part of the email or name' } ) ),
        role: Type.Optional( Type.Enum( PlatformRole ) ),
        verified: Type.Optional( Type.Boolean( { description: 'Only users who did (true) or didn\'t (false) verify their email' } ) ),
        limit: Type.Optional( Type.Integer( { minimum: 1, maximum: 200, default: 50 } ) ),
        offset: Type.Optional( Type.Integer( { minimum: 0, default: 0 } ) ),
    },
    { additionalProperties: false },
);
export type ListUsersQuery = StaticDecode<typeof ListUsersQuery>;

export const AdminUserPage = Type.Object( { items: Type.Array( AdminUser ), total: Type.Integer() } );
export type AdminUserPage = StaticDecode<typeof AdminUserPage>;
export type AdminUserPageJson = StaticEncode<typeof AdminUserPage>;

export const UpdateUserRoleRequest = Type.Object(
    { platformRole: Type.Enum( PlatformRole ) },
    { additionalProperties: false },
);
export type UpdateUserRoleRequest = StaticDecode<typeof UpdateUserRoleRequest>;
