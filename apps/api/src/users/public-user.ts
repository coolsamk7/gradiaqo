import type { User } from '@studylog/database';

/** A user as returned by the API: everything except the password hash. */
export type PublicUser = Omit<User, 'passwordHash'>;

export function toPublicUser( user: User ): PublicUser {
    const { passwordHash: _, ...rest } = user;

    return rest;
}
