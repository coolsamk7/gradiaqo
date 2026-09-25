import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { User } from '@studylog/database';
import { Membership, OrganizationInvitation, OrganizationRole } from '@studylog/database';
import type { CreateInvitationRequest, Invitation, MyInvitation, MyOrganization } from '@studylog/schemas';
import { DataSource, MoreThan, Repository } from 'typeorm';

import { toOrganizationResponse } from './organizations.service.js';

const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Invitations to join an organization, by email. There's no email sending yet: invited users see their
 * invitations in the app (`GET /me/invitations`) once they log in with that email.
 */
@Injectable()
export class InvitationsService {
    constructor( @InjectDataSource() private readonly dataSource: DataSource ) {}

    /** Pending (unexpired) invitations of an organization, newest first. */
    async list( organizationId: string ): Promise<Invitation[]> {
        const invitations = await this.dataSource.getRepository( OrganizationInvitation ).find( {
            where: { organizationId, expiresAt: MoreThan( new Date() ) },
            relations: { invitedBy: true },
            order: { createdAt: 'DESC' },
        } );

        return invitations.map( toInvitationView );
    }

    /** Invites an email. Inviting the same email again updates the role and restarts the expiry. */
    async create( organizationId: string, invitedById: string, dto: CreateInvitationRequest ): Promise<Invitation> {
        const isMember = await this.dataSource.getRepository( Membership ).exists( {
            where: { organizationId, user: { email: dto.email } },
        } );

        if ( isMember ) {
            throw new ConflictException( 'This person is already a member' );
        }

        const repository = this.dataSource.getRepository( OrganizationInvitation );

        await repository.upsert(
            {
                organizationId,
                email: dto.email,
                role: dto.role ?? OrganizationRole.Member,
                invitedById,
                expiresAt: new Date( Date.now() + INVITATION_TTL_MS ),
            },
            [ 'organizationId', 'email' ],
        );

        return toInvitationView( await repository.findOneOrFail( {
            where: { organizationId, email: dto.email },
            relations: { invitedBy: true },
        } ) );
    }

    async revoke( organizationId: string, id: string ): Promise<void> {
        const { affected } = await this.dataSource.getRepository( OrganizationInvitation ).delete( { id, organizationId } );

        if ( !affected ) {
            throw new NotFoundException( 'Invitation not found' );
        }
    }

    /** Pending invitations addressed to the user's email. */
    async listForUser( user: User ): Promise<MyInvitation[]> {
        const invitations = await this.dataSource.getRepository( OrganizationInvitation ).find( {
            where: { email: user.email, expiresAt: MoreThan( new Date() ) },
            relations: { organization: true, invitedBy: true },
            order: { createdAt: 'DESC' },
        } );

        return invitations.map( ( invitation ) => ( {
            ...toInvitationView( invitation ),
            organization: { id: invitation.organization.id, name: invitation.organization.name },
        } ) );
    }

    /** Joins the organization with the invited role. */
    async accept( user: User, id: string ): Promise<MyOrganization> {
        return this.dataSource.transaction( async ( manager ) => {
            const invitation = await this.findForUser( manager.getRepository( OrganizationInvitation ), user, id );
            const alreadyMember = await manager.existsBy( Membership, { userId: user.id, organizationId: invitation.organizationId } );

            if ( !alreadyMember ) {
                await manager.insert( Membership, {
                    userId: user.id,
                    organizationId: invitation.organizationId,
                    role: invitation.role,
                } );
            }
            await manager.delete( OrganizationInvitation, { id } );

            const membership = await manager.findOneOrFail( Membership, {
                where: { userId: user.id, organizationId: invitation.organizationId },
                relations: { organization: true },
            } );

            return { ...toOrganizationResponse( membership.organization ), role: membership.role };
        } );
    }

    async decline( user: User, id: string ): Promise<void> {
        const repository = this.dataSource.getRepository( OrganizationInvitation );

        await this.findForUser( repository, user, id );
        await repository.delete( { id } );
    }

    /** Another user's (or an expired) invitation is "not found". */
    private async findForUser(
        repository: Repository<OrganizationInvitation>,
        user: User,
        id: string,
    ): Promise<OrganizationInvitation> {
        const invitation = await repository.findOneBy( { id, email: user.email } );

        if ( !invitation ) {
            throw new NotFoundException( 'Invitation not found' );
        }
        if ( invitation.expiresAt <= new Date() ) {
            throw new BadRequestException( 'This invitation has expired; ask for a new one' );
        }

        return invitation;
    }
}

function toInvitationView( invitation: OrganizationInvitation ): Invitation {
    const { id, email, role, invitedBy, expiresAt, createdAt } = invitation;

    return {
        id,
        email,
        role,
        invitedBy: invitedBy && { id: invitedBy.id, firstName: invitedBy.firstName, lastName: invitedBy.lastName },
        expiresAt,
        createdAt,
    };
}
