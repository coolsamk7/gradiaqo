import { OrganizationRole } from '@studylog/schemas/enums';
import type { Relation } from 'typeorm';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { Organization } from './organization.entity.js';
import { User } from './user.entity.js';

/**
 * A pending invitation to join an organization. Addressed to an email, so people can be invited before they
 * sign up; they see it once logged in with that email. Deleted when accepted, declined or revoked.
 */
@Entity( 'organization_invitations' )
@Unique( 'uq_organization_invitations_organization_email', [ 'organizationId', 'email' ] )
export class OrganizationInvitation {
    @PrimaryGeneratedColumn( 'uuid' )
    id: string;

    // Covered by the unique (organization, email) index.
    @Column( { name: 'organization_id', type: 'uuid' } )
    organizationId: string;

    @ManyToOne( () => Organization, { onDelete: 'CASCADE' } )
    @JoinColumn( { name: 'organization_id' } )
    organization: Relation<Organization>;

    // Lowercase, like users.email.
    @Index()
    @Column( { type: 'varchar', length: 255 } )
    email: string;

    @Column( { type: 'enum', enum: OrganizationRole, enumName: 'organization_role' } )
    role: OrganizationRole;

    @Column( { name: 'invited_by_id', type: 'uuid', nullable: true } )
    invitedById: string | null;

    @ManyToOne( () => User, { onDelete: 'SET NULL', nullable: true } )
    @JoinColumn( { name: 'invited_by_id' } )
    invitedBy: Relation<User> | null;

    @Column( { name: 'expires_at', type: 'timestamptz' } )
    expiresAt: Date;

    @CreateDateColumn( { name: 'created_at', type: 'timestamptz' } )
    createdAt: Date;
}
