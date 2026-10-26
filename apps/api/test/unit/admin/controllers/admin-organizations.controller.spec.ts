import { AdminOrganizationsController } from '../../../../src/admin/controllers/admin-organizations.controller.js';
import type { AdminOrganizationsService } from '../../../../src/admin/services/admin-organizations.service.js';

describe( 'AdminOrganizationsController', () => {
    it( 'lists organizations', async () => {
        const adminOrganizations = { list: vi.fn().mockResolvedValue( 'page' ) };
        const service = adminOrganizations as unknown as AdminOrganizationsService;
        const controller = new AdminOrganizationsController( service );

        await expect( controller.list( { search: 'club' } ) ).resolves.toBe( 'page' );
        expect( adminOrganizations.list ).toHaveBeenCalledWith( { search: 'club' } );
    } );
} );
