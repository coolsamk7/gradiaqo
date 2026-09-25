import type { AccessTokenPayload } from '@studylog/casl';
import { ReportReason } from '@studylog/database';
import { ReportAction } from '@studylog/schemas';

import { AdminReportsController, PathReportsController } from './reports.controller.js';
import type { ReportsService } from './reports.service.js';

describe( 'reports controllers', () => {
    const reports = { create: vi.fn().mockResolvedValue( 'created' ), list: vi.fn().mockResolvedValue( 'page' ), resolve: vi.fn().mockResolvedValue( 'resolved' ) };
    const user = { sub: 'me' } as AccessTokenPayload;

    it( 'files a report as the logged-in user', async () => {
        const dto = { reason: ReportReason.Spam };

        await expect( new PathReportsController( reports as unknown as ReportsService ).create( user, 'path', dto ) ).resolves.toBe( 'created' );
        expect( reports.create ).toHaveBeenCalledWith( 'me', 'path', dto );
    } );

    it( 'lists and resolves reports, recording which moderator acted', async () => {
        const admin = new AdminReportsController( reports as unknown as ReportsService );

        await expect( admin.list( { limit: 10 } ) ).resolves.toBe( 'page' );
        expect( reports.list ).toHaveBeenCalledWith( { limit: 10 } );

        await expect( admin.resolve( user, 'report', { action: ReportAction.Dismiss } ) ).resolves.toBe( 'resolved' );
        expect( reports.resolve ).toHaveBeenCalledWith( 'me', 'report', { action: ReportAction.Dismiss } );
    } );
} );
