import { AdminOverviewController } from '../../../../src/admin/controllers/admin-overview.controller.js';
import type { AdminOverviewService } from '../../../../src/admin/services/admin-overview.service.js';

describe( 'AdminOverviewController', () => {
    it( 'returns the overview', async () => {
        const adminOverview = { overview: vi.fn().mockResolvedValue( 'overview' ) };

        await expect( new AdminOverviewController( adminOverview as unknown as AdminOverviewService ).overview() ).resolves.toBe( 'overview' );
    } );
} );
