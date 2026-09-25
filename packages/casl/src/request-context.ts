import type { OrganizationRole, PlatformRole } from '@studylog/database';

import type { AppAbility } from './ability.js';

/** Claims inside the access token (JWT). */
export interface AccessTokenPayload {
    sub: string;
    email: string;
    platformRole: PlatformRole;
}

/** The organization a request is about, set by the API's organization guard. */
export interface OrganizationContext {
    organizationId: string;
    /** Null when a superadmin accesses an organization they are not a member of. */
    role: OrganizationRole | null;
}

/** What the auth, organization and ability guards attach to the request. */
export interface AuthorizedRequest {
    user?: AccessTokenPayload;
    organization?: OrganizationContext;
    ability?: AppAbility;
}
