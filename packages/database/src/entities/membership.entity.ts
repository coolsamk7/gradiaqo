import { OrganizationRole } from '@studylog/schemas/enums';
import type { Relation } from 'typeorm';
import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from 'typeorm';

import { Organization } from './organization.entity.js';
import { User } from './user.entity.js';

/** A user's place in an organization, and their role there. */
@Entity( 'memberships' )
@Unique( 'uq_memberships_user_organization', [ 'userId', 'organizationId' ] )
export class Membership {
    @PrimaryGeneratedColumn( 'uuid' )
    id: string;

    @Column( { name: 'user_id', type: 'uuid' } )
    userId: string;

    @ManyToOne( () => User, { onDelete: 'CASCADE' } )
    @JoinColumn( { name: 'user_id' } )
    user: Relation<User>;

    @Index()
    @Column( { name: 'organization_id', type: 'uuid' } )
    organizationId: string;

    @ManyToOne( () => Organization, { onDelete: 'CASCADE' } )
    @JoinColumn( { name: 'organization_id' } )
    organization: Relation<Organization>;

    @Column( {
        type: 'enum',
        enum: OrganizationRole,
        enumName: 'organization_role',
        default: OrganizationRole.Member,
    } )
    role: OrganizationRole;

    @CreateDateColumn( { name: 'created_at', type: 'timestamptz' } )
    createdAt: Date;

    @UpdateDateColumn( { name: 'updated_at', type: 'timestamptz' } )
    updatedAt: Date;
}
