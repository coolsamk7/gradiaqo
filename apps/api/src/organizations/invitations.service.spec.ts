import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { User } from '@studylog/database';
import { Membership, OrganizationInvitation, OrganizationRole } from '@studylog/database';
import type { DataSource } from 'typeorm';

import type { FakeDataSource } from '../../test/unit/fake-data-source.js';
import { fakeDataSource } from '../../test/unit/fake-data-source.js';
import { InvitationsService } from './invitations.service.js';

const ORG = 'org-1';
const priya = { id: 'priya', email: 'priya@example.com' } as User;
const invitation = ( overrides: object = {} ) => ( {
    id: 'inv-1',
    organizationId: ORG,
    email: priya.email,
    role: OrganizationRole.Admin,
    expiresAt: new Date( Date.now() + 60_000 ),
    createdAt: new Date(),
    invitedBy: { id: 'sam', firstName: 'Sam', lastName: 'K', email: 'sam@example.com' },
    ...overrides,
} );

describe( 'InvitationsService', () => {
    let db: FakeDataSource;
    let service: InvitationsService;

    beforeEach( () => {
        db = fakeDataSource();
        service = new InvitationsService( db as unknown as DataSource );
    } );

    describe( 'create', () => {
        it( 'refuses to invite an existing member', async () => {
            db.repo( Membership ).exists.mockResolvedValue( true );

            await expect( service.create( ORG, 'sam', { email: priya.email } ) ).rejects.toThrow( ConflictException );
        } );

        it( 'upserts by (organization, email) as member for 14 days, and never exposes the inviter\'s email', async () => {
            vi.useFakeTimers( { now: new Date( '2026-09-25T00:00:00Z' ) } );
            db.repo( OrganizationInvitation ).findOneOrFail
                .mockResolvedValue( invitation( { role: OrganizationRole.Member } ) );

            const view = await service.create( ORG, 'sam', { email: priya.email } );

            expect( db.repo( OrganizationInvitation ).upsert ).toHaveBeenCalledWith(
                expect.objectContaining( {
                    organizationId: ORG,
                    email: priya.email,
                    role: OrganizationRole.Member,
                    invitedById: 'sam',
                    expiresAt: new Date( '2026-10-09T00:00:00Z' ),
                } ),
                [ 'organizationId', 'email' ],
            );
            expect( view.invitedBy ).toEqual( { id: 'sam', firstName: 'Sam', lastName: 'K' } );
            vi.useRealTimers();
        } );
    } );

    describe( 'accept', () => {
        it( 'joins with the invited role and deletes the invitation', async () => {
            db.repo( OrganizationInvitation ).findOneBy.mockResolvedValue( invitation() );
            db.repo( Membership ).findOneOrFail.mockResolvedValue( {
                role: OrganizationRole.Admin,
                organization: { id: ORG, name: 'Group', slug: 'group', isPersonal: false },
            } );

            const joined = await service.accept( priya, 'inv-1' );

            expect( db.repo( Membership ).insert ).toHaveBeenCalledWith( { userId: 'priya', organizationId: ORG, role: OrganizationRole.Admin } );
            expect( db.repo( OrganizationInvitation ).delete ).toHaveBeenCalledWith( { id: 'inv-1' } );
            expect( joined ).toMatchObject( { id: ORG, role: OrganizationRole.Admin } );
        } );

        it( 'only looks up invitations addressed to the user\'s own email', async () => {
            await expect( service.accept( priya, 'inv-1' ) ).rejects.toThrow( NotFoundException );
            expect( db.repo( OrganizationInvitation ).findOneBy ).toHaveBeenCalledWith( { id: 'inv-1', email: priya.email } );
        } );

        it( 'refuses an expired invitation', async () => {
            db.repo( OrganizationInvitation ).findOneBy
                .mockResolvedValue( invitation( { expiresAt: new Date( Date.now() - 1 ) } ) );

            await expect( service.accept( priya, 'inv-1' ) ).rejects.toThrow( BadRequestException );
            expect( db.repo( Membership ).insert ).not.toHaveBeenCalled();
        } );

        it( 'doesn\'t add a second membership if the user already joined', async () => {
            db.repo( OrganizationInvitation ).findOneBy.mockResolvedValue( invitation() );
            db.repo( Membership ).existsBy.mockResolvedValue( true );
            db.repo( Membership ).findOneOrFail
                .mockResolvedValue( { role: OrganizationRole.Member, organization: { id: ORG } } );

            await service.accept( priya, 'inv-1' );

            expect( db.repo( Membership ).insert ).not.toHaveBeenCalled();
            expect( db.repo( OrganizationInvitation ).delete ).toHaveBeenCalled();
        } );
    } );

    it( 'decline deletes only the user\'s own invitation', async () => {
        await expect( service.decline( priya, 'inv-1' ) ).rejects.toThrow( NotFoundException );

        db.repo( OrganizationInvitation ).findOneBy.mockResolvedValue( invitation() );
        await service.decline( priya, 'inv-1' );

        expect( db.repo( OrganizationInvitation ).delete ).toHaveBeenCalledWith( { id: 'inv-1' } );
    } );

    it( 'revoke is "not found" for another organization\'s invitation', async () => {
        db.repo( OrganizationInvitation ).delete.mockResolvedValue( { affected: 0 } );

        await expect( service.revoke( ORG, 'inv-1' ) ).rejects.toThrow( NotFoundException );
        expect( db.repo( OrganizationInvitation ).delete ).toHaveBeenCalledWith( { id: 'inv-1', organizationId: ORG } );
    } );

    it( 'lists pending invitations of an organization and the ones sent to a user, never expired ones', async () => {
        db.repo( OrganizationInvitation ).find.mockResolvedValueOnce( [ invitation() ] );
        expect( await service.list( ORG ) ).toEqual( [ expect.objectContaining( { id: 'inv-1', email: priya.email } ) ] );

        db.repo( OrganizationInvitation ).find.mockResolvedValueOnce( [ invitation( { organization: { id: ORG, name: 'Group', slug: 'g' } } ) ] );
        expect( await service.listForUser( priya ) ).toEqual( [ expect.objectContaining( { organization: { id: ORG, name: 'Group' } } ) ] );

        expect( db.repo( OrganizationInvitation ).find ).toHaveBeenLastCalledWith( expect.objectContaining( {
            where: { email: priya.email, expiresAt: expect.anything() },
        } ) );
    } );

    it( 'revoke deletes the organization\'s invitation', async () => {
        await service.revoke( ORG, 'inv-1' );

        expect( db.repo( OrganizationInvitation ).delete ).toHaveBeenCalledWith( { id: 'inv-1', organizationId: ORG } );
    } );

    it( 'shows no inviter once they deleted their account', async () => {
        db.repo( OrganizationInvitation ).find.mockResolvedValue( [ invitation( { invitedBy: null } ) ] );

        expect( ( await service.list( ORG ) )[0]?.invitedBy ).toBeNull();
    } );
} );
