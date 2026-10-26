import { AuditArea } from '@studylog/schemas';

import { AdminAuditController } from '../../../../src/admin/controllers/admin-audit.controller.js';
import type { AuditService } from '../../../../src/audit/services/audit.service.js';

describe( 'AdminAuditController', () => {
    it( 'lists the audit log', async () => {
        const audit = { list: vi.fn().mockResolvedValue( 'page' ) };

        await expect( new AdminAuditController( audit as unknown as AuditService ).list( { area: AuditArea.Catalog } ) ).resolves.toBe( 'page' );
        expect( audit.list ).toHaveBeenCalledWith( { area: AuditArea.Catalog } );
    } );
} );
