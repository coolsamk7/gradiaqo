import type { ExecutionContext } from '@nestjs/common';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { OrganizationRole, PlatformRole } from '@studylog/database';

import { OrganizationGuard } from './organization.guard.js';
import type { OrganizationsService } from './organizations.service.js';

const ORG = '22222222-2222-4222-8222-222222222222';

function contextFor( request: object ): ExecutionContext {
    return { switchToHttp: () => ( { getRequest: () => request } ) } as unknown as ExecutionContext;
}

const requestFor = ( platformRole: PlatformRole, params: object = { organizationId: ORG }, headers: object = {} ) =>
    ( { user: { sub: 'user-1', platformRole }, params, headers } ) as Record<string, unknown>;

describe( 'OrganizationGuard', () => {
    const organizations = {
        findMembership: vi.fn(),
        findById: vi.fn(),
    };
    const guard = new OrganizationGuard( organizations as unknown as OrganizationsService );

    beforeEach( () => {
        organizations.findMembership.mockResolvedValue( null );
        organizations.findById.mockResolvedValue( { id: ORG } );
    } );

    it( 'needs a logged-in user', async () => {
        const anonymous = contextFor( { params: {}, headers: {} } );

        await expect( guard.canActivate( anonymous ) ).rejects.toThrow( UnauthorizedException );
    } );

    it( 'needs a valid organization id', async () => {
        await expect( guard.canActivate( contextFor( requestFor( PlatformRole.ApplicationUser, { organizationId: 'x' } ) ) ) )
            .rejects.toThrow( BadRequestException );
    } );

    it( 'answers non-members with 404, so organization ids can\'t be probed', async () => {
        await expect( guard.canActivate( contextFor( requestFor( PlatformRole.ApplicationUser ) ) ) )
            .rejects.toThrow( NotFoundException );
    } );

    it( 'attaches the member\'s role and abilities for the organization', async () => {
        organizations.findMembership.mockResolvedValue( { organizationId: ORG, role: OrganizationRole.Admin } );
        const request = requestFor( PlatformRole.ApplicationUser );

        await expect( guard.canActivate( contextFor( request ) ) ).resolves.toBe( true );
        expect( request.organization ).toEqual( { organizationId: ORG, role: OrganizationRole.Admin } );
        expect( ( request.ability as { can: ( a: string, s: string ) => boolean } ).can( 'update', 'Organization' ) ).toBe( true );
    } );

    it( 'reads the organization from the X-Organization-Id header when the route has no id', async () => {
        organizations.findMembership.mockResolvedValue( { organizationId: ORG, role: OrganizationRole.Member } );

        await expect( guard.canActivate( contextFor( requestFor( PlatformRole.ApplicationUser, {}, { 'x-organization-id': ORG } ) ) ) )
            .resolves.toBe( true );
        expect( organizations.findMembership ).toHaveBeenCalledWith( 'user-1', ORG );
    } );

    it( 'lets a superadmin into an existing organization without a role, but not into one that doesn\'t exist', async () => {
        const request = requestFor( PlatformRole.Superadmin );

        await expect( guard.canActivate( contextFor( request ) ) ).resolves.toBe( true );
        expect( request.organization ).toEqual( { organizationId: ORG, role: null } );

        organizations.findById.mockResolvedValue( null );
        await expect( guard.canActivate( contextFor( requestFor( PlatformRole.Superadmin ) ) ) )
            .rejects.toThrow( NotFoundException );
    } );
} );
