import { subject } from '@casl/ability';
import { OrganizationRole, PlatformRole } from '@studylog/database';
import { describe, expect, it } from 'vitest';

import { defineAbilityFor } from './ability.js';

const ME = 'user-me';
const ORG = 'org-mine';
const OTHER_ORG = 'org-other';

const organization = ( id: string, isPersonal = false ) => subject( 'Organization', { id, isPersonal } );
const membership = ( organizationId: string, role: OrganizationRole ) =>
    subject( 'Membership', { organizationId, role, userId: 'someone' } );
const user = ( id: string ) => subject( 'User', { id } );
const path = ( organizationId: string | null ) => subject( 'LearningPath', { organizationId } );
const item = ( organizationId: string | null ) => subject( 'Item', { organizationId } );

function abilityFor( role: OrganizationRole | null, platformRole = PlatformRole.ApplicationUser ) {
    return defineAbilityFor( {
        userId: ME,
        platformRole,
        membership: role ? { organizationId: ORG, role } : null,
    } );
}

describe( 'defineAbilityFor', () => {
    describe( 'owner', () => {
        const ability = abilityFor( OrganizationRole.Owner );

        it( 'manages their organization and its members', () => {
            expect( ability.can( 'update', organization( ORG ) ) ).toBe( true );
            expect( ability.can( 'delete', organization( ORG ) ) ).toBe( true );
            expect( ability.can( 'delete', membership( ORG, OrganizationRole.Owner ) ) ).toBe( true );
        } );

        it( 'cannot delete a personal workspace', () => {
            expect( ability.can( 'delete', organization( ORG, true ) ) ).toBe( false );
        } );

        it( 'manages the organization\'s own catalog, not the global one or another organization\'s', () => {
            expect( ability.can( 'create', 'LearningPath' ) ).toBe( true );
            expect( ability.can( 'update', path( ORG ) ) ).toBe( true );
            expect( ability.can( 'delete', item( ORG ) ) ).toBe( true );
            expect( ability.can( 'update', path( null ) ) ).toBe( false );
            expect( ability.can( 'update', item( OTHER_ORG ) ) ).toBe( false );
        } );

        it( 'has no access to other organizations', () => {
            expect( ability.can( 'read', organization( OTHER_ORG ) ) ).toBe( false );
            expect( ability.can( 'delete', membership( OTHER_ORG, OrganizationRole.Member ) ) ).toBe( false );
        } );
    } );

    describe( 'admin', () => {
        const ability = abilityFor( OrganizationRole.Admin );

        it( 'can rename but not delete the organization', () => {
            expect( ability.can( 'update', organization( ORG ) ) ).toBe( true );
            expect( ability.can( 'delete', organization( ORG ) ) ).toBe( false );
        } );

        it( 'manages members and admins, but never the owner', () => {
            expect( ability.can( 'delete', membership( ORG, OrganizationRole.Member ) ) ).toBe( true );
            expect( ability.can( 'update', membership( ORG, OrganizationRole.Admin ) ) ).toBe( true );
            expect( ability.can( 'update', membership( ORG, OrganizationRole.Owner ) ) ).toBe( false );
            expect( ability.can( 'delete', membership( ORG, OrganizationRole.Owner ) ) ).toBe( false );
        } );

        it( 'manages the organization\'s catalog', () => {
            expect( ability.can( 'manage', 'Topic' ) ).toBe( true );
            expect( ability.can( 'update', path( ORG ) ) ).toBe( true );
        } );

        it( 'has no access to other organizations', () => {
            expect( ability.can( 'update', organization( OTHER_ORG ) ) ).toBe( false );
            expect( ability.can( 'delete', membership( OTHER_ORG, OrganizationRole.Member ) ) ).toBe( false );
        } );
    } );

    describe( 'member', () => {
        const ability = abilityFor( OrganizationRole.Member );

        it( 'can only read the organization and its members', () => {
            expect( ability.can( 'read', organization( ORG ) ) ).toBe( true );
            expect( ability.can( 'read', membership( ORG, OrganizationRole.Admin ) ) ).toBe( true );
            expect( ability.can( 'update', organization( ORG ) ) ).toBe( false );
            expect( ability.can( 'delete', membership( ORG, OrganizationRole.Member ) ) ).toBe( false );
        } );

        it( 'can read but not change the organization\'s catalog', () => {
            expect( ability.can( 'read', path( ORG ) ) ).toBe( true );
            expect( ability.can( 'create', 'LearningPath' ) ).toBe( false );
            expect( ability.can( 'update', path( ORG ) ) ).toBe( false );
        } );
    } );

    describe( 'application user outside any organization', () => {
        const ability = abilityFor( null );

        it( 'can read and update only their own user record', () => {
            expect( ability.can( 'update', user( ME ) ) ).toBe( true );
            expect( ability.can( 'update', user( 'someone-else' ) ) ).toBe( false );
        } );

        it( 'cannot see organizations', () => {
            expect( ability.can( 'read', organization( ORG ) ) ).toBe( false );
        } );

        it( 'cannot manage the learning catalog', () => {
            for ( const catalogSubject of [ 'LearningPath', 'LearningModule', 'Topic', 'Item' ] as const ) {
                expect( ability.can( 'create', catalogSubject ) ).toBe( false );
                expect( ability.can( 'manage', catalogSubject ) ).toBe( false );
            }
        } );
    } );

    describe( 'superadmin', () => {
        const ability = abilityFor( null, PlatformRole.Superadmin );

        it( 'manages everything without being a member', () => {
            expect( ability.can( 'update', organization( OTHER_ORG ) ) ).toBe( true );
            expect( ability.can( 'delete', user( 'someone-else' ) ) ).toBe( true );
        } );

        it( 'manages the learning catalog', () => {
            for ( const catalogSubject of [ 'LearningPath', 'LearningModule', 'Topic', 'Item' ] as const ) {
                expect( ability.can( 'manage', catalogSubject ) ).toBe( true );
            }
        } );

        it( 'still cannot delete a personal workspace', () => {
            expect( ability.can( 'delete', organization( OTHER_ORG, true ) ) ).toBe( false );
        } );
    } );
} );
