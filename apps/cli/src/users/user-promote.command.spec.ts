import { stripVTControlCharacters } from 'node:util';

import { PlatformRole } from '@studylog/database';
import type { DataSource } from 'typeorm';

import type { DatabaseService } from '../database/database.service.js';
import { UserPromoteCommand } from './user-promote.command.js';

/** A DatabaseService with one user (or none), recording role changes. */
function databaseWith( user: { id: string; platformRole: PlatformRole } | null ) {
    const users = {
        findOneBy: vi.fn( () => Promise.resolve( user ) ),
        update: vi.fn( () => Promise.resolve() ),
    };
    const dataSource = { getRepository: () => users };
    const database = {
        withDataSource: vi.fn( ( work: ( ds: DataSource ) => unknown ) =>
            Promise.resolve( work( dataSource as unknown as DataSource ) ) ),
    };

    return { command: new UserPromoteCommand( database as unknown as DatabaseService ), users };
}

describe( 'user:promote', () => {
    let stdout: string[];
    let stderr: string[];

    beforeEach( () => {
        stdout = [];
        stderr = [];
        vi.spyOn( process.stdout, 'write' ).mockImplementation( ( chunk ) => stdout.push( String( chunk ) ) > 0 );
        vi.spyOn( process.stderr, 'write' ).mockImplementation( ( chunk ) => stderr.push( String( chunk ) ) > 0 );
        process.exitCode = undefined;
    } );

    afterEach( () => {
        vi.restoreAllMocks();
        process.exitCode = undefined;
    } );

    const printed = () => stripVTControlCharacters( stdout.join( '' ) );
    const errors = () => stripVTControlCharacters( stderr.join( '' ) );

    it( 'makes the user a superadmin, found by their email in any case', async () => {
        const { command, users } = databaseWith( { id: 'u1', platformRole: PlatformRole.ApplicationUser } );

        await command.run( [ ' Sam@Example.com ' ], {} );

        expect( users.findOneBy ).toHaveBeenCalledWith( { email: 'sam@example.com' } );
        expect( users.update ).toHaveBeenCalledWith( { id: 'u1' }, { platformRole: PlatformRole.Superadmin } );
        expect( printed() ).toContain( '✔ sam@example.com is now superadmin.\n' );
        expect( printed() ).toContain( 'It applies the next time their access token is renewed' );
        expect( process.exitCode ).toBeUndefined();
    } );

    it( 'makes a superadmin a normal user again with --demote', async () => {
        const { command, users } = databaseWith( { id: 'u1', platformRole: PlatformRole.Superadmin } );

        await command.run( [ 'sam@example.com' ], { demote: true } );

        expect( users.update ).toHaveBeenCalledWith( { id: 'u1' }, { platformRole: PlatformRole.ApplicationUser } );
        expect( printed() ).toContain( 'sam@example.com is now application_user.' );
    } );

    it( 'changes nothing when the user already has the role', async () => {
        const { command, users } = databaseWith( { id: 'u1', platformRole: PlatformRole.Superadmin } );

        await command.run( [ 'sam@example.com' ], {} );

        expect( users.update ).not.toHaveBeenCalled();
        expect( printed() ).toBe( 'sam@example.com is already superadmin.\n' );
    } );

    it( 'fails for an unknown email', async () => {
        const { command, users } = databaseWith( null );

        await command.run( [ 'nobody@example.com' ], {} );

        expect( users.update ).not.toHaveBeenCalled();
        expect( errors() ).toBe( '✖ No user with the email nobody@example.com.\n' );
        expect( process.exitCode ).toBe( 1 );
    } );

    it( 'has a --demote flag', () => {
        expect( databaseWith( null ).command.parseDemote() ).toBe( true );
    } );
} );
