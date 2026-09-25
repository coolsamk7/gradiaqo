import type { CanActivate, ExecutionContext } from '@nestjs/common';
import {
    createParamDecorator,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    SetMetadata,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { Action, AppAbility, SubjectType } from './ability.js';
import { defineAbilityFor } from './ability.js';
import type { AuthorizedRequest, OrganizationContext } from './request-context.js';

export type AbilityRequirement = [ Action, SubjectType ];

const CHECK_ABILITIES_KEY = 'studylog:check-abilities';

/**
 * Route-level permission check, e.g. `@CheckAbilities( [ 'update', 'Organization' ] )`.
 * Needs `AbilityGuard` after the auth guard (and the organization guard, for org routes).
 */
export const CheckAbilities = ( ...requirements: AbilityRequirement[] ) =>
    SetMetadata( CHECK_ABILITIES_KEY, requirements );

@Injectable()
export class AbilityGuard implements CanActivate {
    constructor( private readonly reflector: Reflector ) {}

    canActivate( context: ExecutionContext ): boolean {
        const requirements =
            this.reflector.getAllAndOverride<AbilityRequirement[] | undefined>(
                CHECK_ABILITIES_KEY,
                [ context.getHandler(), context.getClass() ],
            ) ?? [];
        const request = context.switchToHttp().getRequest<AuthorizedRequest>();

        if ( !request.user ) {
            throw new UnauthorizedException();
        }

        // Outside an organization, only platform-level rules apply.
        request.ability ??= defineAbilityFor( {
            userId: request.user.sub,
            platformRole: request.user.platformRole,
        } );

        const ability = request.ability;

        if ( !requirements.every( ( [ action, subject ] ) => ability.can( action, subject ) ) ) {
            throw new ForbiddenException();
        }

        return true;
    }
}

/** The CASL ability for the current user. Use after `AbilityGuard`. */
export const CurrentAbility = createParamDecorator( ( _data: unknown, context: ExecutionContext ): AppAbility => {
    const { ability } = context.switchToHttp().getRequest<AuthorizedRequest>();

    if ( !ability ) {
        throw new InternalServerErrorException( 'AbilityGuard did not run for this route' );
    }

    return ability;
} );

/** The organization the request is about. Use after the organization guard. */
export const CurrentOrganization = createParamDecorator(
    ( _data: unknown, context: ExecutionContext ): OrganizationContext => {
        const { organization } = context.switchToHttp().getRequest<AuthorizedRequest>();

        if ( !organization ) {
            throw new InternalServerErrorException( 'Organization guard did not run for this route' );
        }

        return organization;
    },
);
