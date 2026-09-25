import type { StaticDecode, StaticEncode } from 'typebox';
import Type from 'typebox';

import { PlatformRole } from './enums.js';
import { IsoDate, Uuid } from './primitives.js';

/** A user as returned by the API. Never includes the password hash. */
export const User = Type.Object( {
    id: Uuid(),
    email: Type.String( { examples: [ 'sameer@example.com' ] } ),
    firstName: Type.String( { examples: [ 'Sameer' ] } ),
    lastName: Type.String( { examples: [ 'Khandke' ] } ),
    platformRole: Type.Enum( PlatformRole ),
    createdAt: IsoDate(),
    updatedAt: IsoDate(),
} );
/** As used in code (dates are `Date`). */
export type User = StaticDecode<typeof User>;
/** As sent over HTTP (dates are ISO strings), e.g. what the frontend receives. */
export type UserJson = StaticEncode<typeof User>;
