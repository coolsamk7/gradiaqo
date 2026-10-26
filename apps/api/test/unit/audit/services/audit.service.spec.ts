import { AuditAction, AuditEvent, User } from '@studylog/database';
import { AuditArea } from '@studylog/schemas';
import type { DataSource } from 'typeorm';
import { In } from 'typeorm';

import { AuditService } from '../../../../src/audit/services/audit.service.js';
import type { FakeDataSource } from '../../fake-data-source.js';
import { fakeDataSource } from '../../fake-data-source.js';

describe( 'AuditService', () => {
    let db: FakeDataSource;
    let service: AuditService;

    beforeEach( () => {
        db = fakeDataSource();
        service = new AuditService( db as unknown as DataSource );
    } );

    describe( 'record', () => {
        it( 'stores who did what to what, with their names at the time', async () => {
            db.repo( User ).findOneBy.mockResolvedValue( { id: 'admin', firstName: 'Ada', lastName: 'Admin' } );

            await service.record( { actorId: 'admin', action: AuditAction.PathHidden, targetId: 'p', targetLabel: 'Graphs', note: 'Copied' } );

            expect( db.repo( User ).findOneBy ).toHaveBeenCalledWith( { id: 'admin' } );
            expect( db.repo( AuditEvent ).insert ).toHaveBeenCalledWith( {
                actorId: 'admin',
                actorName: 'Ada Admin',
                action: AuditAction.PathHidden,
                targetId: 'p',
                targetLabel: 'Graphs',
                note: 'Copied',
            } );
        } );

        it( 'has no note unless given one, and copes with an admin who was just deleted', async () => {
            await service.record( { actorId: 'gone', action: AuditAction.UserPromoted, targetId: 'u', targetLabel: 'sam@example.com' } );

            expect( db.repo( AuditEvent ).insert ).toHaveBeenCalledWith( expect.objectContaining( { actorName: 'A deleted account', note: null } ) );
        } );
    } );

    describe( 'list', () => {
        it( 'is every event, newest first, 50 at a time', async () => {
            const createdAt = new Date();

            db.repo( AuditEvent ).findAndCount.mockResolvedValue( [ [ {
                id: 'e1',
                actorId: null,
                actorName: 'Ada Admin',
                action: AuditAction.UserRemoved,
                targetId: 'u',
                targetLabel: 'sam@example.com',
                note: null,
                createdAt,
            } ], 9 ] );

            await expect( service.list( {} ) ).resolves.toEqual( {
                items: [ {
                    id: 'e1',
                    action: AuditAction.UserRemoved,
                    actor: { id: null, name: 'Ada Admin' },
                    targetId: 'u',
                    targetLabel: 'sam@example.com',
                    note: null,
                    createdAt,
                } ],
                total: 9,
            } );
            expect( db.repo( AuditEvent ).findAndCount ).toHaveBeenCalledWith( { order: { createdAt: 'DESC', id: 'ASC' }, take: 50, skip: 0 } );
        } );

        it( 'filters by area of Admin', async () => {
            await service.list( { area: AuditArea.Users, limit: 10, offset: 20 } );

            expect( db.repo( AuditEvent ).findAndCount ).toHaveBeenCalledWith( {
                where: { action: In( [ AuditAction.UserPromoted, AuditAction.UserDemoted, AuditAction.UserRemoved ] ) },
                order: { createdAt: 'DESC', id: 'ASC' },
                take: 10,
                skip: 20,
            } );
        } );
    } );
} );
