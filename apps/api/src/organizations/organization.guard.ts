import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { AuthorizedRequest } from '@studylog/casl';
import { defineAbilityFor } from '@studylog/casl';
import { PlatformRole } from '@studylog/database';
import type { Request } from 'express';
import { IsUuid } from 'typebox/format';

import { OrganizationsService } from './organizations.service.js';

export const ORGANIZATION_HEADER = 'x-organization-id';

/**
 * Resolves which organization the request is about (`:organizationId` route param, or the
 * `X-Organization-Id` header), checks the user belongs to it, and builds their CASL ability
 * for it. Runs after AuthGuard and before AbilityGuard.
 */
@Injectable()
export class OrganizationGuard implements CanActivate {
    constructor( private readonly organizationsService: OrganizationsService ) {}

    async canActivate( context: ExecutionContext ): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request & AuthorizedRequest>();
        const { user } = request;

        if ( !user ) {
            throw new UnauthorizedException();
        }

        const organizationId = request.params.organizationId ?? request.headers[ORGANIZATION_HEADER];

        if ( typeof organizationId !== 'string' || !IsUuid( organizationId ) ) {
            throw new BadRequestException( 'A valid organization id is required' );
        }

        const membership = await this.organizationsService.findMembership( user.sub, organizationId );

        // Non-members get 404, not 403, so organization ids can't be probed.
        if ( !membership ) {
            const isSuperadmin = user.platformRole === PlatformRole.Superadmin;

            if ( !isSuperadmin || !( await this.organizationsService.findById( organizationId ) ) ) {
                throw new NotFoundException( 'Organization not found' );
            }
        }

        request.organization = { organizationId, role: membership?.role ?? null };
        request.ability = defineAbilityFor( {
            userId: user.sub,
            platformRole: user.platformRole,
            membership,
        } );

        return true;
    }
}
