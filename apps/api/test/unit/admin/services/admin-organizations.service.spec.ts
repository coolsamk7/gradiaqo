import type { DataSource } from 'typeorm';

import { AdminOrganizationsService } from '../../../../src/admin/services/admin-organizations.service.js';
import type { FakeDataSource } from '../../fake-data-source.js';
import { fakeDataSource } from '../../fake-data-source.js';

const created = new Date( '2026-10-01T00:00:00.000Z' );
const CLUB = { id: 'club', name: 'Club', isPersonal: false, createdAt: created, memberCount: 3, pathCount: 2 };
const SOLO = { id: 'solo', name: 'Solo', isPersonal: false, createdAt: created, memberCount: 1, pathCount: 0 };
const ALICE = { organizationId: 'club', id: 'alice', firstName: 'Alice', lastName: 'Walker', email: 'alice@example.com' };
const BOB = { organizationId: 'club', id: 'bob', firstName: 'Bob', lastName: 'Singh', email: 'bob@example.com' };

describe( 'AdminOrganizationsService', () => {
    let db: FakeDataSource;
    let service: AdminOrganizationsService;

    beforeEach( () => {
        db = fakeDataSource();
        db.query.mockImplementation( ( sql: string ) => {
            if ( sql.includes( 'AS total' ) ) {
                return Promise.resolve( [ { total: 7 } ] );
            }

            return Promise.resolve( sql.includes( 'm.role = \'owner\'' ) ? [ ALICE, BOB ] : [ CLUB, SOLO ] );
        } );
        service = new AdminOrganizationsService( db as unknown as DataSource );
    } );

    it( 'lists organizations with their owners, oldest owner first, and the total', async () => {
        const page = await service.list( {} );

        expect( page ).toEqual( {
            items: [
                { ...CLUB, owners: [
                    { id: 'alice', firstName: 'Alice', lastName: 'Walker', email: 'alice@example.com' },
                    { id: 'bob', firstName: 'Bob', lastName: 'Singh', email: 'bob@example.com' },
                ] },
                { ...SOLO, owners: [] },
            ],
            total: 7,
        } );

        const [ list, count, owners ] = db.query.mock.calls as [ string, unknown[] ][];

        // Groups only, no search, the first 50, newest first.
        expect( list[1] ).toEqual( [ false, null, 50, 0 ] );
        expect( list[0] ).toContain( 'ORDER BY org.created_at DESC, org.id ASC LIMIT $3 OFFSET $4' );
        expect( list[0] ).toContain( '( SELECT COUNT(*)::int FROM memberships m WHERE m.organization_id = org.id ) AS "memberCount"' );
        expect( list[0] ).toContain( '( SELECT COUNT(*)::int FROM learning_paths p WHERE p.organization_id = org.id ) AS "pathCount"' );
        expect( count[1] ).toEqual( [ false, null ] );
        expect( owners[0] ).toContain( 'ORDER BY m.created_at ASC' );
        expect( owners[1] ).toEqual( [ [ 'club', 'solo' ] ] );
    } );

    it( 'matches the name or a member\'s email, literally, and can include personal workspaces', async () => {
        await service.list( { search: ' 50%_off ', personal: true, limit: 10, offset: 20 } );

        const [ list, count ] = db.query.mock.calls as [ string, unknown[] ][];

        expect( list[1] ).toEqual( [ true, '%50\\%\\_off%', 10, 20 ] );
        expect( count[1] ).toEqual( [ true, '%50\\%\\_off%' ] );
        expect( count[0] ).toContain( '( $1::boolean OR NOT org.is_personal )' );
        expect( count[0] ).toContain( 'org.name ILIKE $2 OR EXISTS' );
        expect( count[0] ).toContain( 'WHERE m.organization_id = org.id AND u.email ILIKE $2' );
    } );

    it( 'ignores a blank search, and doesn\'t look up owners for an empty page', async () => {
        db.query.mockImplementation( ( sql: string ) => Promise.resolve( sql.includes( 'AS total' ) ? [ { total: 0 } ] : [] ) );

        await expect( service.list( { search: '  ' } ) ).resolves.toEqual( { items: [], total: 0 } );
        expect( db.query ).toHaveBeenCalledTimes( 2 );
        expect( ( db.query.mock.calls[0] as [ string, unknown[] ] )[1] ).toEqual( [ false, null, 50, 0 ] );
    } );
} );
