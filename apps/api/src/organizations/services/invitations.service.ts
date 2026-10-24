import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import type { User } from '@studylog/database';
import { Membership, OrganizationInvitation, OrganizationRole } from '@studylog/database';
import type { CreateInvitationRequest, Invitation, MyInvitation, MyOrganization } from '@studylog/schemas';
import { DataSource, MoreThan, Repository } from 'typeorm';

import { appConfig } from '../../config/app.config.js';
import { MailService } from '../../mail/services/mail.service.js';
import { invitationMail } from '../../mail/templates.js';
import { toOrganizationResponse } from './organizations.service.js';

const INVITATION_TTL_DAYS = 14;
const INVITATION_TTL_MS = INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Invitations to join an organization, by email. The invited person gets an email, and sees the invitation in the
 * app (`GET /me/invitations`) once logged in with that address, even if the email didn't arrive.
 */
@Injectable()
export class InvitationsService {
    private readonly logger = new Logger( InvitationsService.name );
    private readonly acceptUrl: string;

    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly mail: MailService,
        @Inject( appConfig.KEY ) app: ConfigType<typeof appConfig>,
    ) {
        this.acceptUrl = `${app.webAppUrl}/app/organizations`;
    }

    /** Pending (unexpired) invitations of an organization, newest first. */
    async list( organizationId: string ): Promise<Invitation[]> {
        const invitations = await this.dataSource.getRepository( OrganizationInvitation ).find( {
            where: { organizationId, expiresAt: MoreThan( new Date() ) },
            relations: { invitedBy: true },
            order: { createdAt: 'DESC' },
        } );

        return invitations.map( toInvitationView );
    }

    /**
     * Invites an email and emails them. Inviting the same email again updates the role, restarts the expiry and
     * sends the email again.
     */
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

        const invitation = await repository.findOneOrFail( {
            where: { organizationId, email: dto.email },
            relations: { invitedBy: true, organization: true },
        } );

        await this.sendEmail( invitation );

        return toInvitationView( invitation );
    }

    async revoke( organizationId: string, id: string ): Promise<void> {
        const invitations = this.dataSource.getRepository( OrganizationInvitation );
        const { affected } = await invitations.delete( { id, organizationId } );

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
            const alreadyMember = await manager.existsBy( Membership, {
                userId: user.id,
                organizationId: invitation.organizationId,
            } );

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

    /** Best effort: the invitation stands without it, and shows in the app. */
    private async sendEmail( { email, role, invitedBy, organization }: OrganizationInvitation ): Promise<void> {
        try {
            await this.mail.send( invitationMail( email, {
                inviter: invitedBy && `${invitedBy.firstName} ${invitedBy.lastName}`,
                organization: organization.name,
                role,
                url: this.acceptUrl,
                days: INVITATION_TTL_DAYS,
            } ) );
        } catch ( err ) {
            this.logger.warn( `Couldn't email the invitation to ${organization.name}: ${( err as Error ).message}` );
        }
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
