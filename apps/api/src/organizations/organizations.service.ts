import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { User } from '@studylog/database';
import { Membership, Organization, OrganizationRole } from '@studylog/database';
import type { Member, MyOrganization, Organization as OrganizationView } from '@studylog/schemas';
import type { EntityManager } from 'typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class OrganizationsService {
    constructor(
        @InjectRepository( Organization ) private readonly organizations: Repository<Organization>,
        @InjectRepository( Membership ) private readonly memberships: Repository<Membership>,
    ) {}

    /** Creates the user's personal workspace and makes them its owner. Runs inside the signup transaction. */
    async createPersonal( user: User, manager: EntityManager ): Promise<Organization> {
        const name = `${user.firstName}'s Workspace`.slice( 0, 100 );
        const organization = await manager.save(
            manager.create( Organization, {
                name,
                slug: toSlug( name ),
                isPersonal: true,
                createdById: user.id,
            } ),
        );

        await manager.save(
            manager.create( Membership, {
                userId: user.id,
                organizationId: organization.id,
                role: OrganizationRole.Owner,
            } ),
        );

        return organization;
    }

    /** Every organization the user belongs to: their own personal workspace first, then oldest first. */
    async listForUser( userId: string ): Promise<MyOrganization[]> {
        const memberships = await this.memberships.find( {
            where: { userId },
            relations: { organization: true },
        } );
        const isOwnWorkspace = ( { organization }: Membership ) =>
            organization.isPersonal && organization.createdById === userId;

        return memberships
            .sort( ( a, b ) =>
                Number( isOwnWorkspace( b ) ) - Number( isOwnWorkspace( a ) )
                || a.organization.createdAt.getTime() - b.organization.createdAt.getTime() )
            .map( ( { organization, role } ) => ( { ...toOrganizationResponse( organization ), role } ) );
    }

    findMembership( userId: string, organizationId: string ): Promise<Membership | null> {
        return this.memberships.findOneBy( { userId, organizationId } );
    }

    findById( id: string ): Promise<Organization | null> {
        return this.organizations.findOneBy( { id } );
    }

    async rename( organization: Organization, name: string ): Promise<Organization> {
        organization.name = name;

        return this.organizations.save( organization );
    }

    /** Members ordered owner → admin → member, then by join date. */
    async listMembers( organizationId: string ): Promise<Member[]> {
        const memberships = await this.memberships.find( {
            where: { organizationId },
            relations: { user: true },
            order: { role: 'ASC', createdAt: 'ASC' },
        } );

        return memberships.map( ( { user, role, createdAt } ) => ( {
            userId: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role,
            joinedAt: createdAt,
        } ) );
    }
}

export function toOrganizationResponse( organization: Organization ): OrganizationView {
    const { id, name, slug, isPersonal, createdAt, updatedAt } = organization;

    return { id, name, slug, isPersonal, createdAt, updatedAt };
}

/** "Sameer's Workspace" → "sameers-workspace-3f9a1c". The random suffix keeps slugs unique. */
function toSlug( name: string ): string {
    const base = name
        .toLowerCase()
        .normalize( 'NFKD' )
        .replace( /[^a-z0-9\s-]/g, '' )
        .trim()
        .replace( /[\s-]+/g, '-' )
        .slice( 0, 100 );

    return `${base || 'workspace'}-${randomBytes( 3 ).toString( 'hex' )}`;
}
