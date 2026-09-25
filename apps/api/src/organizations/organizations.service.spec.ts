import { ConflictException, NotFoundException } from '@nestjs/common';
import type { User } from '@studylog/database';
import { Membership, Organization, OrganizationRole } from '@studylog/database';
import type { DataSource, EntityManager, Repository } from 'typeorm';

import type { FakeDataSource } from '../../test/unit/fake-data-source.js';
import { fakeDataSource } from '../../test/unit/fake-data-source.js';
import { OrganizationsService } from './organizations.service.js';

const ORG = 'org-1';
const owner = ( userId: string ) => ( { userId, organizationId: ORG, role: OrganizationRole.Owner } );

describe( 'OrganizationsService', () => {
    let db: FakeDataSource;
    let service: OrganizationsService;

    beforeEach( () => {
        db = fakeDataSource();
        service = new OrganizationsService(
            db.repo( Organization ) as unknown as Repository<Organization>,
            db.repo( Membership ) as unknown as Repository<Membership>,
            db as unknown as DataSource,
        );
    } );

    it( 'create makes a shared organization with the creator as owner', async () => {
        const created = await service.create( 'user-1', 'DSA Study Group' );

        expect( db.repo( Organization ).save ).toHaveBeenCalledWith(
            expect.objectContaining( { name: 'DSA Study Group', isPersonal: false, createdById: 'user-1' } ),
        );
        expect( created.slug ).toMatch( /^dsa-study-group-[0-9a-f]{6}$/ );
        expect( db.repo( Membership ).insert ).toHaveBeenCalledWith(
            { userId: 'user-1', organizationId: created.id, role: OrganizationRole.Owner },
        );
        expect( created.role ).toBe( OrganizationRole.Owner );
    } );

    it( 'createPersonal names the workspace after the user and makes them owner', async () => {
        const user = { id: 'user-1', firstName: 'Sam' } as User;
        const workspace = await service.createPersonal( user, db.manager as unknown as EntityManager );

        expect( workspace ).toMatchObject( { name: 'Sam\'s Workspace', isPersonal: true } );
        expect( workspace.slug ).toMatch( /^sams-workspace-[0-9a-f]{6}$/ );
        expect( db.repo( Membership ).save ).toHaveBeenCalledWith(
            expect.objectContaining( { userId: 'user-1', role: OrganizationRole.Owner } ),
        );
    } );

    describe( 'changeRole', () => {
        it( 'locks the owners while checking', async () => {
            db.repo( Membership ).find.mockResolvedValue( [ owner( 'a' ), owner( 'b' ) ] );
            db.repo( Membership ).find.mockResolvedValueOnce( [ owner( 'a' ), owner( 'b' ) ] );
            db.repo( Membership ).find.mockResolvedValueOnce( [ { ...owner( 'a' ), user: { id: 'a' }, createdAt: new Date() } ] );

            await service.changeRole( ORG, 'a', OrganizationRole.Admin );

            expect( db.repo( Membership ).find ).toHaveBeenCalledWith( expect.objectContaining( {
                where: { organizationId: ORG, role: OrganizationRole.Owner },
                lock: { mode: 'pessimistic_write' },
            } ) );
        } );

        it( 'refuses to demote the last owner', async () => {
            db.repo( Membership ).find.mockResolvedValue( [ owner( 'a' ) ] );

            await expect( service.changeRole( ORG, 'a', OrganizationRole.Admin ) ).rejects.toThrow( ConflictException );
            expect( db.repo( Membership ).update ).not.toHaveBeenCalled();
        } );

        it( 'lets the last owner stay owner, and demotes an owner when another remains', async () => {
            db.repo( Membership ).find.mockResolvedValueOnce( [ owner( 'a' ), owner( 'b' ) ] );
            db.repo( Membership ).find.mockResolvedValueOnce( [ { ...owner( 'a' ), role: OrganizationRole.Admin, user: { id: 'a' } } ] );

            await expect( service.changeRole( ORG, 'a', OrganizationRole.Admin ) ).resolves.toMatchObject( { userId: 'a' } );
            expect( db.repo( Membership ).update ).toHaveBeenCalledWith(
                { organizationId: ORG, userId: 'a' },
                { role: OrganizationRole.Admin },
            );
        } );

        it( 'is "not found" for someone who isn\'t a member', async () => {
            db.repo( Membership ).find.mockResolvedValue( [ owner( 'a' ) ] );
            db.repo( Membership ).update.mockResolvedValue( { affected: 0 } );

            await expect( service.changeRole( ORG, 'stranger', OrganizationRole.Admin ) ).rejects.toThrow( NotFoundException );
        } );
    } );

    describe( 'removeMember', () => {
        it( 'refuses to remove (or let leave) the last owner', async () => {
            db.repo( Membership ).find.mockResolvedValue( [ owner( 'a' ) ] );

            await expect( service.removeMember( ORG, 'a' ) ).rejects.toThrow( ConflictException );
            expect( db.repo( Membership ).delete ).not.toHaveBeenCalled();
        } );

        it( 'removes anyone else', async () => {
            db.repo( Membership ).find.mockResolvedValue( [ owner( 'a' ) ] );

            await service.removeMember( ORG, 'b' );

            expect( db.repo( Membership ).delete ).toHaveBeenCalledWith( { organizationId: ORG, userId: 'b' } );
        } );

        it( 'is "not found" for someone who isn\'t a member', async () => {
            db.repo( Membership ).delete.mockResolvedValue( { affected: 0 } );

            await expect( service.removeMember( ORG, 'b' ) ).rejects.toThrow( NotFoundException );
        } );
    } );

    it( 'listForUser puts the user\'s own workspace first, then the oldest organizations', async () => {
        const org = ( id: string, created: string, isPersonal = false, createdById = 'someone' ) => ( {
            organization: { id, isPersonal, createdById, createdAt: new Date( created ) },
            role: OrganizationRole.Member,
        } );

        db.repo( Membership ).find.mockResolvedValue( [
            org( 'newer', '2026-03-01' ),
            org( 'older', '2026-01-01' ),
            org( 'mine', '2026-06-01', true, 'user-1' ),
        ] );

        expect( ( await service.listForUser( 'user-1' ) ).map( ( o ) => o.id ) ).toEqual( [ 'mine', 'older', 'newer' ] );
    } );

    it( 'reads, renames and removes organizations and memberships', async () => {
        const organization = { id: ORG, name: 'Old' } as Organization;

        await service.findById( ORG );
        await service.findMember( ORG, 'a' );
        await service.findMembership( 'a', ORG );
        await service.rename( organization, 'New' );
        await service.remove( organization );

        expect( db.repo( Organization ).findOneBy ).toHaveBeenCalledWith( { id: ORG } );
        expect( db.repo( Membership ).findOneBy ).toHaveBeenCalledWith( { organizationId: ORG, userId: 'a' } );
        expect( db.repo( Organization ).save ).toHaveBeenCalledWith( expect.objectContaining( { name: 'New' } ) );
        expect( db.repo( Organization ).remove ).toHaveBeenCalledWith( organization );
    } );

    it( 'changeRole is "not found" if the member left in the meantime', async () => {
        db.repo( Membership ).find.mockResolvedValueOnce( [ owner( 'a' ), owner( 'b' ) ] );
        db.repo( Membership ).find.mockResolvedValueOnce( [] );

        await expect( service.changeRole( ORG, 'a', OrganizationRole.Admin ) ).rejects.toThrow( NotFoundException );
    } );

    it( 'slugs fall back to "workspace" when the name has no letters or digits', async () => {
        const created = await service.create( 'user-1', '!!!' );

        expect( created.slug ).toMatch( /^workspace-[0-9a-f]{6}$/ );
    } );
} );
