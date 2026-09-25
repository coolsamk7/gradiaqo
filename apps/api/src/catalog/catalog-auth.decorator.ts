import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { applyDecorators, createParamDecorator, Injectable, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { AuthorizedRequest } from '@studylog/casl';
import { AbilityGuard } from '@studylog/casl';
import type { Request } from 'express';

import { AuthGuard } from '../auth/auth.guard.js';
import { OrganizationGuard } from '../organizations/organization.guard.js';
import type { CatalogOwner as CatalogOwnerId } from './catalog.helpers.js';

/**
 * Catalog controllers serve two catalogs with the same routes: `/admin/catalog/...` (the global catalog) and
 * `/organizations/:organizationId/catalog/...` (an organization's own). For the latter, this runs the
 * organization guard (membership check + the member's abilities); otherwise platform-level rules apply.
 */
@Injectable()
export class CatalogScopeGuard implements CanActivate {
    constructor( private readonly organizationGuard: OrganizationGuard ) {}

    canActivate( context: ExecutionContext ): boolean | Promise<boolean> {
        const { params } = context.switchToHttp().getRequest<Request>();

        return params.organizationId === undefined || this.organizationGuard.canActivate( context );
    }
}

/** Logged in → member of the organization (organization routes) → allowed by `@CheckAbilities()`. */
export const CatalogAuth = () =>
    applyDecorators(
        UseGuards( AuthGuard, CatalogScopeGuard, AbilityGuard ),
        ApiBearerAuth(),
        ApiUnauthorizedResponse( { description: 'Missing or invalid access token' } ),
        ApiForbiddenResponse( { description: 'Superadmins manage the global catalog; organization owners and admins their own' } ),
        ApiNotFoundResponse( { description: 'Not found, or not in this catalog (or you are not a member of the organization)' } ),
    );

/** Whose catalog the route is about: the organization id from the route, or null for the global catalog. */
export const CatalogOwner = createParamDecorator( ( _data: unknown, context: ExecutionContext ): CatalogOwnerId =>
    context.switchToHttp().getRequest<AuthorizedRequest>().organization?.organizationId ?? null );
