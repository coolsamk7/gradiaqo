import type { ExecutionContext } from '@nestjs/common';

import type { OrganizationGuard } from '../organizations/organization.guard.js';
import { CatalogScopeGuard } from './catalog-auth.decorator.js';

const contextFor = ( params: object ) =>
    ( { switchToHttp: () => ( { getRequest: () => ( { params } ) } ) } ) as unknown as ExecutionContext;

describe( 'CatalogScopeGuard', () => {
    const organizationGuard = { canActivate: vi.fn().mockResolvedValue( true ) };
    const guard = new CatalogScopeGuard( organizationGuard as unknown as OrganizationGuard );

    it( 'checks membership on /organizations/:organizationId/catalog routes', async () => {
        await expect( guard.canActivate( contextFor( { organizationId: 'org-1' } ) ) ).resolves.toBe( true );
        expect( organizationGuard.canActivate ).toHaveBeenCalledOnce();
    } );

    it( 'leaves /admin/catalog routes to platform rules (an X-Organization-Id header can\'t switch catalogs)', () => {
        organizationGuard.canActivate.mockClear();

        expect( guard.canActivate( contextFor( {} ) ) ).toBe( true );
        expect( organizationGuard.canActivate ).not.toHaveBeenCalled();
    } );
} );
