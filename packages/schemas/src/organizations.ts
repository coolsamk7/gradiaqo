import type { StaticDecode, StaticEncode } from 'typebox';
import Type from 'typebox';

import { OrganizationRole } from './enums.js';
import { IsoDate, TrimmedText, Uuid } from './primitives.js';

export const Organization = Type.Object( {
    id: Uuid(),
    name: Type.String( { examples: [ 'Sameer\'s Workspace' ] } ),
    slug: Type.String( { examples: [ 'sameers-workspace-3f9a1c' ] } ),
    isPersonal: Type.Boolean( { description: 'The workspace created automatically at signup' } ),
    createdAt: IsoDate(),
    updatedAt: IsoDate(),
} );
export type Organization = StaticDecode<typeof Organization>;

/** An organization plus the current user's role in it. */
export const MyOrganization = Type.Object( {
    ...Organization.properties,
    role: Type.Union( [ Type.Enum( OrganizationRole ), Type.Null() ], {
        description: 'Null only when a superadmin views an organization they are not a member of',
    } ),
} );
export type MyOrganization = StaticDecode<typeof MyOrganization>;
export type MyOrganizationJson = StaticEncode<typeof MyOrganization>;

export const Member = Type.Object( {
    userId: Uuid(),
    email: Type.String( { examples: [ 'sameer@example.com' ] } ),
    firstName: Type.String(),
    lastName: Type.String(),
    role: Type.Enum( OrganizationRole ),
    joinedAt: IsoDate(),
} );
export type Member = StaticDecode<typeof Member>;

export const UpdateOrganizationRequest = Type.Object(
    { name: TrimmedText( 100, [ 'Study Group' ] ) },
    { additionalProperties: false },
);
export type UpdateOrganizationRequest = StaticDecode<typeof UpdateOrganizationRequest>;
