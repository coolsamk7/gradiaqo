import type { AccessTokenPayload } from '@studylog/casl';
import { ReportReason } from '@studylog/database';
import { ReportAction } from '@studylog/schemas';

import { AdminHiddenPathsController, AdminReportsController, PathReportsController } from '../../../src/moderation/reports.controller.js';
import type { ReportsService } from '../../../src/moderation/reports.service.js';

describe( 'reports controllers', () => {
    const reports = {
        create: vi.fn().mockResolvedValue( 'created' ),
        list: vi.fn().mockResolvedValue( 'page' ),
        resolve: vi.fn().mockResolvedValue( 'resolved' ),
        unhide: vi.fn(),
    };
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

    it( 'un-hides a path', async () => {
        await new AdminHiddenPathsController( reports as unknown as ReportsService ).unhide( 'path' );

        expect( reports.unhide ).toHaveBeenCalledWith( 'path' );
    } );
} );
