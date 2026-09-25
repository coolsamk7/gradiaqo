import type { StaticDecode, StaticEncode } from 'typebox';
import Type from 'typebox';

import { OrganizationRole } from './enums.js';
import { Email, IsoDate, TrimmedText, Uuid } from './primitives.js';

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

export const CreateOrganizationRequest = Type.Object(
    { name: TrimmedText( 100, [ 'DSA Study Group' ] ) },
    { additionalProperties: false },
);
export type CreateOrganizationRequest = StaticDecode<typeof CreateOrganizationRequest>;

/** Roles an invitation or a role change can give. Ownership is given with a role change, not an invitation. */
const InvitableRole = () =>
    Type.Union( [ Type.Literal( OrganizationRole.Admin ), Type.Literal( OrganizationRole.Member ) ] );

export const UpdateMemberRequest = Type.Object(
    { role: Type.Enum( OrganizationRole, { description: 'Only owners can make someone an owner' } ) },
    { additionalProperties: false },
);
export type UpdateMemberRequest = StaticDecode<typeof UpdateMemberRequest>;

const PersonName = Type.Object( { id: Uuid(), firstName: Type.String(), lastName: Type.String() } );

/** A pending invitation, as the organization's owners and admins see it. */
export const Invitation = Type.Object( {
    id: Uuid(),
    email: Type.String( { examples: [ 'priya@example.com' ] } ),
    role: Type.Enum( OrganizationRole ),
    invitedBy: Type.Union( [ PersonName, Type.Null() ] ),
    expiresAt: IsoDate(),
    createdAt: IsoDate(),
} );
export type Invitation = StaticDecode<typeof Invitation>;

/** A pending invitation, as the invited user sees it. */
export const MyInvitation = Type.Object( {
    id: Uuid(),
    organization: Type.Object( { id: Uuid(), name: Type.String() } ),
    role: Type.Enum( OrganizationRole ),
    invitedBy: Type.Union( [ PersonName, Type.Null() ] ),
    expiresAt: IsoDate(),
    createdAt: IsoDate(),
} );
export type MyInvitation = StaticDecode<typeof MyInvitation>;

export const CreateInvitationRequest = Type.Object(
    {
        email: Email(),
        role: Type.Optional( InvitableRole() ),
    },
    {
        additionalProperties: false,
        description: 'Invites someone by email, whether or not they have an account yet. Default role: member.',
    },
);
export type CreateInvitationRequest = StaticDecode<typeof CreateInvitationRequest>;
