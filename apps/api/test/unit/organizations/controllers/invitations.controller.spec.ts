import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AccessTokenPayload } from '@studylog/casl';
import { OrganizationRole } from '@studylog/database';

import { MyInvitationsController, OrganizationInvitationsController } from '../../../../src/organizations/controllers/invitations.controller.js';
import type { InvitationsService } from '../../../../src/organizations/services/invitations.service.js';
import type { OrganizationsService } from '../../../../src/organizations/services/organizations.service.js';
import type { UsersService } from '../../../../src/users/services/users.service.js';

const context = { organizationId: 'org', role: OrganizationRole.Owner };
const user = { sub: 'me' } as AccessTokenPayload;
const me = { id: 'me', email: 'me@example.com' };

describe( 'invitation controllers', () => {
    const invitations = {
        list: vi.fn().mockResolvedValue( [] ),
        create: vi.fn().mockResolvedValue( 'invitation' ),
        revoke: vi.fn(),
        listForUser: vi.fn().mockResolvedValue( [] ),
        accept: vi.fn().mockResolvedValue( 'joined' ),
        decline: vi.fn(),
    };
    const organizations = { findById: vi.fn() };
    const users = { findByIdOrFail: vi.fn().mockResolvedValue( me ) };
    const organizationSide = new OrganizationInvitationsController(
        invitations as unknown as InvitationsService,
        organizations as unknown as OrganizationsService,
    );
    const mine = new MyInvitationsController(
        invitations as unknown as InvitationsService,
        users as unknown as UsersService,
    );

    it( 'lists and revokes invitations of the organization from the route', async () => {
        await organizationSide.list( context );
        await organizationSide.revoke( context, 'inv' );

        expect( invitations.list ).toHaveBeenCalledWith( 'org' );
        expect( invitations.revoke ).toHaveBeenCalledWith( 'org', 'inv' );
    } );

    it( 'invites as the logged-in user, but never into a personal workspace', async () => {
        organizations.findById.mockResolvedValue( { id: 'org', isPersonal: false } );
        await expect( organizationSide.create( user, context, { email: 'priya@example.com' } ) ).resolves.toBe( 'invitation' );
        expect( invitations.create ).toHaveBeenCalledWith( 'org', 'me', { email: 'priya@example.com' } );

        organizations.findById.mockResolvedValue( { id: 'org', isPersonal: true } );
        await expect( organizationSide.create( user, context, { email: 'priya@example.com' } ) ).rejects.toThrow( BadRequestException );
    } );

    it( 'is "not found" if the organization was deleted after the guard ran', async () => {
        organizations.findById.mockResolvedValue( null );

        await expect( organizationSide.create( user, context, { email: 'priya@example.com' } ) ).rejects.toThrow( NotFoundException );
    } );

    it( 'works on the logged-in user\'s own invitations, by their current email', async () => {
        await mine.list( user );
        await expect( mine.accept( user, 'inv' ) ).resolves.toBe( 'joined' );
        await mine.decline( user, 'inv' );

        expect( users.findByIdOrFail ).toHaveBeenCalledWith( 'me' );
        expect( invitations.listForUser ).toHaveBeenCalledWith( me );
        expect( invitations.accept ).toHaveBeenCalledWith( me, 'inv' );
        expect( invitations.decline ).toHaveBeenCalledWith( me, 'inv' );
    } );
} );
