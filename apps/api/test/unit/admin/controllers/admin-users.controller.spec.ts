import type { AccessTokenPayload } from '@studylog/casl';
import { PlatformRole } from '@studylog/database';

import { AdminUsersController } from '../../../../src/admin/controllers/admin-users.controller.js';
import type { AdminUsersService } from '../../../../src/admin/services/admin-users.service.js';

describe( 'AdminUsersController', () => {
    const adminUsers = {
        list: vi.fn().mockResolvedValue( 'page' ),
        setRole: vi.fn().mockResolvedValue( 'updated' ),
        remove: vi.fn(),
    };
    const controller = new AdminUsersController( adminUsers as unknown as AdminUsersService );
    const admin = { sub: 'admin' } as AccessTokenPayload;

    it( 'lists users', async () => {
        await expect( controller.list( { search: 'sam' } ) ).resolves.toBe( 'page' );
        expect( adminUsers.list ).toHaveBeenCalledWith( { search: 'sam' } );
    } );

    it( 'changes roles and removes accounts as the logged-in admin', async () => {
        await expect( controller.setRole( admin, 'user-1', { platformRole: PlatformRole.Superadmin } ) ).resolves.toBe( 'updated' );
        expect( adminUsers.setRole ).toHaveBeenCalledWith( 'admin', 'user-1', PlatformRole.Superadmin );

        await controller.remove( admin, 'user-1' );
        expect( adminUsers.remove ).toHaveBeenCalledWith( 'admin', 'user-1' );
    } );
} );
