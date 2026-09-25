import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { OrganizationRole, PlatformRole } from '@studylog/database';
import { describe, expect, it } from 'vitest';

import type { AbilityRequirement } from './ability.guard.js';
import { AbilityGuard, CheckAbilities, CurrentAbility, CurrentOrganization } from './ability.guard.js';
import { defineAbilityFor } from './ability.js';
import type { AuthorizedRequest } from './request-context.js';

/** A route handler decorated with `@CheckAbilities( ...requirements )`, and a request for it. */
function routeWith( requirements: AbilityRequirement[], request: AuthorizedRequest ): ExecutionContext {
    const handler = () => undefined;

    // What `@CheckAbilities()` does to a route handler.
    CheckAbilities( ...requirements )( handler );

    return {
        getHandler: () => handler,
        getClass: () => Object,
        switchToHttp: () => ( { getRequest: () => request } ),
    } as unknown as ExecutionContext;
}

const user = ( platformRole = PlatformRole.ApplicationUser ) => ( { sub: 'me', email: 'me@example.com', platformRole } );

describe( 'AbilityGuard', () => {
    const guard = new AbilityGuard( new Reflector() );

    it( 'needs a logged-in user', () => {
        expect( () => guard.canActivate( routeWith( [], {} ) ) ).toThrow( UnauthorizedException );
    } );

    it( 'outside an organization, builds platform-level abilities and checks them', () => {
        const request: AuthorizedRequest = { user: user() };

        expect( () => guard.canActivate( routeWith( [ [ 'manage', 'LearningPath' ] ], request ) ) ).toThrow( ForbiddenException );
        expect( request.ability?.can( 'update', 'User' ) ).toBe( true );

        expect( guard.canActivate( routeWith( [ [ 'manage', 'LearningPath' ] ], { user: user( PlatformRole.Superadmin ) } ) ) ).toBe( true );
    } );

    it( 'uses the organization abilities the organization guard already attached', () => {
        const request: AuthorizedRequest = {
            user: user(),
            ability: defineAbilityFor( {
                userId: 'me',
                platformRole: PlatformRole.ApplicationUser,
                membership: { organizationId: 'org', role: OrganizationRole.Admin },
            } ),
        };

        expect( guard.canActivate( routeWith( [ [ 'update', 'Organization' ] ], request ) ) ).toBe( true );
        expect( () => guard.canActivate( routeWith( [ [ 'delete', 'Organization' ] ], request ) ) ).toThrow( ForbiddenException );
    } );

    it( 'needs every listed requirement', () => {
        const request: AuthorizedRequest = { user: user() };

        expect( () => guard.canActivate( routeWith( [ [ 'read', 'User' ], [ 'delete', 'User' ] ], request ) ) ).toThrow( ForbiddenException );
    } );

    it( 'lets logged-in users through routes without requirements', () => {
        expect( guard.canActivate( routeWith( [], { user: user() } ) ) ).toBe( true );
    } );

    it( 'lets logged-in users through routes without @CheckAbilities at all', () => {
        const context = {
            getHandler: () => () => undefined,
            getClass: () => Object,
            switchToHttp: () => ( { getRequest: () => ( { user: user() } ) } ),
        } as unknown as ExecutionContext;

        expect( guard.canActivate( context ) ).toBe( true );
    } );
} );

/** The function behind a `createParamDecorator()` decorator, read back from the route metadata Nest stores. */
function factoryOf( decorator: () => ParameterDecorator ) {
    class Target {
        handler() {
            return this;
        }
    }

    decorator()( Target.prototype, 'handler', 0 );

    const args = Reflect.getMetadata( ROUTE_ARGS_METADATA, Target, 'handler' ) as Record<string, { factory: unknown }>;

    return Object.values( args )[0].factory as ( data: unknown, context: ExecutionContext ) => unknown;
}

const withRequest = ( request: object ) =>
    ( { switchToHttp: () => ( { getRequest: () => request } ) } ) as unknown as ExecutionContext;

describe( 'request decorators', () => {
    it( '@CurrentAbility() is the ability the guard built, and fails loudly if the guard is missing', () => {
        const ability = defineAbilityFor( { userId: 'me', platformRole: PlatformRole.ApplicationUser } );

        expect( factoryOf( CurrentAbility )( undefined, withRequest( { ability } ) ) ).toBe( ability );
        expect( () => factoryOf( CurrentAbility )( undefined, withRequest( {} ) ) )
            .toThrow( InternalServerErrorException );
    } );

    it( '@CurrentOrganization() is the organization the guard resolved, and fails loudly if the guard is missing', () => {
        const organization = { organizationId: 'org', role: OrganizationRole.Member };

        expect( factoryOf( CurrentOrganization )( undefined, withRequest( { organization } ) ) ).toBe( organization );
        expect( () => factoryOf( CurrentOrganization )( undefined, withRequest( {} ) ) ).toThrow( 'Organization guard did not run' );
    } );
} );
