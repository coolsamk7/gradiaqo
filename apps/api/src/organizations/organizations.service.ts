import { randomBytes } from 'node:crypto';

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { User } from '@studylog/database';
import { CatalogStatus, LearningPath, Membership, Organization, OrganizationRole } from '@studylog/database';
import type { Member, MyOrganization, Organization as OrganizationView, OrganizationSummary } from '@studylog/schemas';
import type { EntityManager } from 'typeorm';
import { DataSource, In, Repository } from 'typeorm';

/** Members shown as avatars on an organization's card. */
const MEMBER_PREVIEW = 5;

@Injectable()
export class OrganizationsService {
    constructor(
        @InjectRepository( Organization ) private readonly organizations: Repository<Organization>,
        @InjectRepository( Membership ) private readonly memberships: Repository<Membership>,
        @InjectDataSource() private readonly dataSource: DataSource,
    ) {}

    /** Creates a shared organization (e.g. a study group) with the user as its owner. */
    async create( userId: string, name: string ): Promise<MyOrganization> {
        const organization = await this.dataSource.transaction( async ( manager ) => {
            const created = await manager.save( manager.create( Organization, {
                name,
                slug: toSlug( name ),
                isPersonal: false,
                createdById: userId,
            } ) );

            await manager.insert( Membership, { userId, organizationId: created.id, role: OrganizationRole.Owner } );

            return created;
        } );

        return { ...toOrganizationResponse( organization ), role: OrganizationRole.Owner };
    }

    /** Deletes the organization with its memberships, invitations, paths and items. */
    async remove( organization: Organization ): Promise<void> {
        await this.organizations.remove( organization );
    }

    findMember( organizationId: string, userId: string ): Promise<Membership | null> {
        return this.memberships.findOneBy( { organizationId, userId } );
    }

    /**
     * Changes a member's role. An organization always keeps at least one owner, so the last owner can't be
     * demoted: make someone else owner first.
     */
    async changeRole( organizationId: string, userId: string, role: OrganizationRole ): Promise<Member> {
        await this.dataSource.transaction( async ( manager ) => {
            const owners = await lockOwners( manager, organizationId );
            const isLastOwner = owners.length === 1 && owners[0]?.userId === userId;

            if ( isLastOwner && role !== OrganizationRole.Owner ) {
                throw new ConflictException( 'An organization needs an owner: make someone else owner first' );
            }
            const { affected } = await manager.update( Membership, { organizationId, userId }, { role } );

            if ( !affected ) {
                throw new NotFoundException( 'Member not found' );
            }
        } );

        const members = await this.listMembers( organizationId );
        const member = members.find( ( candidate ) => candidate.userId === userId );

        if ( !member ) {
            throw new NotFoundException( 'Member not found' );
        }

        return member;
    }

    /** Removes a member (or lets them leave). The last owner can't go: transfer ownership or delete instead. */
    async removeMember( organizationId: string, userId: string ): Promise<void> {
        await this.dataSource.transaction( async ( manager ) => {
            const owners = await lockOwners( manager, organizationId );

            if ( owners.length === 1 && owners[0]?.userId === userId ) {
                throw new ConflictException(
                    'The last owner can\'t leave: make someone else owner first, or delete the organization',
                );
            }

            const { affected } = await manager.delete( Membership, { organizationId, userId } );

            if ( !affected ) {
                throw new NotFoundException( 'Member not found' );
            }
        } );
    }

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

    /** The user's organizations (in listForUser's order) with their member and published path counts. */
    async summariesForUser( userId: string ): Promise<OrganizationSummary[]> {
        const organizations = await this.listForUser( userId );

        if ( organizations.length === 0 ) {
            return [];
        }

        const organizationIds = In( organizations.map( ( organization ) => organization.id ) );
        const memberships = await this.memberships.find( {
            where: { organizationId: organizationIds },
            relations: { user: true },
            order: { role: 'ASC', createdAt: 'ASC' },
        } );
        const paths = await this.dataSource.getRepository( LearningPath ).find( {
            select: { id: true, organizationId: true },
            where: { organizationId: organizationIds, status: CatalogStatus.Published },
        } );

        return organizations.map( ( organization ) => {
            const members = memberships.filter( ( membership ) => membership.organizationId === organization.id );

            return {
                ...organization,
                memberCount: members.length,
                pathCount: paths.filter( ( path ) => path.organizationId === organization.id ).length,
                members: members.slice( 0, MEMBER_PREVIEW ).map( ( { user } ) => ( {
                    userId: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                } ) ),
            };
        } );
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

/** Personal workspaces have exactly one member, their owner; memberships there can't change. */
export function assertShared( organization: Organization ): void {
    if ( organization.isPersonal ) {
        throw new BadRequestException( 'Not possible in a personal workspace: it always has just its owner' );
    }
}

/** The organization's owners, locked until the transaction ends so two requests can't both remove "another" owner. */
function lockOwners( manager: EntityManager, organizationId: string ): Promise<Membership[]> {
    return manager.find( Membership, {
        where: { organizationId, role: OrganizationRole.Owner },
        lock: { mode: 'pessimistic_write' },
    } );
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
