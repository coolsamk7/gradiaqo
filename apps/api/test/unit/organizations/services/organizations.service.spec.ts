import { ConflictException, NotFoundException } from '@nestjs/common';
import type { User } from '@studylog/database';
import { CatalogStatus, LearningPath, Membership, Organization, OrganizationRole } from '@studylog/database';
import type { DataSource, EntityManager, Repository } from 'typeorm';

import { OrganizationsService } from '../../../../src/organizations/services/organizations.service.js';
import type { FakeDataSource } from '../../fake-data-source.js';
import { fakeDataSource } from '../../fake-data-source.js';

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

    it( 'summariesForUser adds member and published path counts, and the first five members', async () => {
        const person = ( n: number ) => ( { id: `u${n}`, firstName: `F${n}`, lastName: `L${n}` } );

        db.repo( Membership ).find
            .mockResolvedValueOnce( [
                { organization: { id: 'mine', isPersonal: true, createdById: 'user-1', createdAt: new Date() }, role: OrganizationRole.Owner },
                { organization: { id: 'club', isPersonal: false, createdById: 'u0', createdAt: new Date() }, role: OrganizationRole.Member },
            ] )
            .mockResolvedValueOnce( [
                { organizationId: 'mine', user: person( 9 ) },
                ...[ 0, 1, 2, 3, 4, 5 ].map( ( n ) => ( { organizationId: 'club', user: person( n ) } ) ),
            ] );
        db.repo( LearningPath ).find.mockResolvedValue( [
            { id: 'p1', organizationId: 'club' },
            { id: 'p2', organizationId: 'club' },
            { id: 'p3', organizationId: 'mine' },
        ] );

        const [ mine, club ] = await service.summariesForUser( 'user-1' );

        expect( mine ).toMatchObject( { id: 'mine', memberCount: 1, pathCount: 1, members: [ { userId: 'u9', firstName: 'F9', lastName: 'L9' } ] } );
        expect( club ).toMatchObject( { id: 'club', role: OrganizationRole.Member, memberCount: 6, pathCount: 2 } );
        expect( club?.members.map( ( member ) => member.userId ) ).toEqual( [ 'u0', 'u1', 'u2', 'u3', 'u4' ] );
        expect( db.repo( LearningPath ).find ).toHaveBeenCalledWith( expect.objectContaining( {
            where: expect.objectContaining( { status: CatalogStatus.Published } ) as unknown,
        } ) );
    } );

    it( 'summariesForUser has nothing to count without organizations', async () => {
        db.repo( Membership ).find.mockResolvedValue( [] );

        expect( await service.summariesForUser( 'user-1' ) ).toEqual( [] );
        expect( db.repo( Membership ).find ).toHaveBeenCalledOnce();
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
