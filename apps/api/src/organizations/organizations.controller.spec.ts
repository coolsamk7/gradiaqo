import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AccessTokenPayload } from '@studylog/casl';
import { defineAbilityFor } from '@studylog/casl';
import { Membership, Organization, OrganizationRole, PlatformRole } from '@studylog/database';

import { OrganizationsController } from './organizations.controller.js';
import type { OrganizationsService } from './organizations.service.js';

/*
 * The record-level permission checks live in the controller; these use the real CASL rules.
 */

const ORG = 'org-1';
const user = ( platformRole = PlatformRole.ApplicationUser ): AccessTokenPayload =>
    ( { sub: 'me', email: 'me@example.com', platformRole } );
const context = ( role: OrganizationRole | null ) => ( { organizationId: ORG, role } );
const abilityFor = ( role: OrganizationRole | null, platformRole = PlatformRole.ApplicationUser ) =>
    defineAbilityFor( { userId: 'me', platformRole, membership: role ? { organizationId: ORG, role } : null } );
const membership = ( userId: string, role: OrganizationRole ) =>
    Object.assign( new Membership(), { userId, organizationId: ORG, role } );
const organization = ( isPersonal = false ) => Object.assign( new Organization(), { id: ORG, isPersonal } );

describe( 'OrganizationsController permissions', () => {
    const service = {
        findById: vi.fn(),
        findMember: vi.fn(),
        changeRole: vi.fn(),
        removeMember: vi.fn(),
        remove: vi.fn(),
        summariesForUser: vi.fn().mockResolvedValue( [] ),
        create: vi.fn().mockResolvedValue( { id: 'new' } ),
        rename: vi.fn( ( organization: Organization, name: string ) =>
            Promise.resolve( Object.assign( organization, { name } ) ) ),
        listMembers: vi.fn().mockResolvedValue( [] ),
    };
    const controller = new OrganizationsController( service as unknown as OrganizationsService );

    beforeEach( () => {
        vi.clearAllMocks();
        service.findById.mockResolvedValue( organization() );
    } );

    describe( 'changeRole', () => {
        it( 'lets an admin promote a member to admin', async () => {
            service.findMember.mockResolvedValue( membership( 'priya', OrganizationRole.Member ) );

            await controller.changeRole( user(), context( OrganizationRole.Admin ), abilityFor( OrganizationRole.Admin ), 'priya', { role: OrganizationRole.Admin } );

            expect( service.changeRole ).toHaveBeenCalledWith( ORG, 'priya', OrganizationRole.Admin );
        } );

        it( 'doesn\'t let an admin make someone owner', async () => {
            service.findMember.mockResolvedValue( membership( 'priya', OrganizationRole.Member ) );

            await expect( controller.changeRole( user(), context( OrganizationRole.Admin ), abilityFor( OrganizationRole.Admin ), 'priya', { role: OrganizationRole.Owner } ) )
                .rejects.toThrow( ForbiddenException );
        } );

        it( 'doesn\'t let an admin change an owner', async () => {
            service.findMember.mockResolvedValue( membership( 'sam', OrganizationRole.Owner ) );

            await expect( controller.changeRole( user(), context( OrganizationRole.Admin ), abilityFor( OrganizationRole.Admin ), 'sam', { role: OrganizationRole.Member } ) )
                .rejects.toThrow( ForbiddenException );
            expect( service.changeRole ).not.toHaveBeenCalled();
        } );

        it( 'lets an owner, or a superadmin, make someone owner', async () => {
            service.findMember.mockResolvedValue( membership( 'priya', OrganizationRole.Member ) );

            await controller.changeRole( user(), context( OrganizationRole.Owner ), abilityFor( OrganizationRole.Owner ), 'priya', { role: OrganizationRole.Owner } );
            await controller.changeRole( user( PlatformRole.Superadmin ), context( null ), abilityFor( null, PlatformRole.Superadmin ), 'priya', { role: OrganizationRole.Owner } );

            expect( service.changeRole ).toHaveBeenCalledTimes( 2 );
        } );

        it( 'is not possible in a personal workspace', async () => {
            service.findById.mockResolvedValue( organization( true ) );

            await expect( controller.changeRole( user(), context( OrganizationRole.Owner ), abilityFor( OrganizationRole.Owner ), 'me', { role: OrganizationRole.Member } ) )
                .rejects.toThrow( BadRequestException );
        } );

        it( 'is "not found" for a non-member', async () => {
            service.findMember.mockResolvedValue( null );

            await expect( controller.changeRole( user(), context( OrganizationRole.Owner ), abilityFor( OrganizationRole.Owner ), 'x', { role: OrganizationRole.Member } ) )
                .rejects.toThrow( NotFoundException );
        } );
    } );

    describe( 'removeMember', () => {
        it( 'lets an admin remove a member but not an owner', async () => {
            service.findMember.mockResolvedValueOnce( membership( 'priya', OrganizationRole.Member ) );
            await controller.removeMember( context( OrganizationRole.Admin ), abilityFor( OrganizationRole.Admin ), 'priya' );
            expect( service.removeMember ).toHaveBeenCalledWith( ORG, 'priya' );

            service.findMember.mockResolvedValueOnce( membership( 'sam', OrganizationRole.Owner ) );
            await expect( controller.removeMember( context( OrganizationRole.Admin ), abilityFor( OrganizationRole.Admin ), 'sam' ) )
                .rejects.toThrow( ForbiddenException );
        } );
    } );

    describe( 'remove (delete organization)', () => {
        it( 'is for owners only, and never a personal workspace', async () => {
            await expect( controller.remove( context( OrganizationRole.Admin ), abilityFor( OrganizationRole.Admin ) ) )
                .rejects.toThrow( ForbiddenException );

            await controller.remove( context( OrganizationRole.Owner ), abilityFor( OrganizationRole.Owner ) );
            expect( service.remove ).toHaveBeenCalledOnce();

            service.findById.mockResolvedValue( organization( true ) );
            await expect( controller.remove( context( OrganizationRole.Owner ), abilityFor( OrganizationRole.Owner ) ) )
                .rejects.toThrow( BadRequestException );
        } );
    } );

    it( 'leave is for members; superadmins without a membership get 404', async () => {
        await controller.leave( user(), context( OrganizationRole.Member ) );
        expect( service.removeMember ).toHaveBeenCalledWith( ORG, 'me' );

        await expect( controller.leave( user( PlatformRole.Superadmin ), context( null ) ) )
            .rejects.toThrow( NotFoundException );
    } );

    describe( 'reading and renaming', () => {
        it( 'lists the user\'s organizations and creates one as them', async () => {
            await controller.listMine( user() );
            await controller.create( user(), { name: 'Group' } );

            expect( service.summariesForUser ).toHaveBeenCalledWith( 'me' );
            expect( service.create ).toHaveBeenCalledWith( 'me', 'Group' );
        } );

        it( 'findOne returns the organization with the caller\'s role (null for a visiting superadmin)', async () => {
            expect( await controller.findOne( context( null ) ) ).toMatchObject( { id: ORG, role: null } );

            service.findById.mockResolvedValue( null );
            await expect( controller.findOne( context( OrganizationRole.Member ) ) )
                .rejects.toThrow( NotFoundException );
        } );

        it( 'rename is for owners and admins of that organization', async () => {
            const renamed = await controller.update( context( OrganizationRole.Admin ), abilityFor( OrganizationRole.Admin ), { name: 'New' } );

            expect( renamed ).toMatchObject( { name: 'New', role: OrganizationRole.Admin } );
            await expect( controller.update( context( OrganizationRole.Member ), abilityFor( OrganizationRole.Member ), { name: 'New' } ) )
                .rejects.toThrow( ForbiddenException );

            service.findById.mockResolvedValue( null );
            await expect( controller.update( context( OrganizationRole.Owner ), abilityFor( OrganizationRole.Owner ), { name: 'New' } ) )
                .rejects.toThrow( NotFoundException );
        } );

        it( 'lists the members of the organization from the route', async () => {
            await controller.listMembers( context( OrganizationRole.Member ) );

            expect( service.listMembers ).toHaveBeenCalledWith( ORG );
        } );

        it( 'management routes are "not found" once the organization is gone', async () => {
            service.findById.mockResolvedValue( null );

            await expect( controller.leave( user(), context( OrganizationRole.Member ) ) )
                .rejects.toThrow( NotFoundException );
        } );
    } );
} );
