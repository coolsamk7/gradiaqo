import { PlatformRole, User } from '@studylog/database';
import { Command, CommandRunner, Option } from 'nest-commander';

import { DatabaseService } from '../database/database.service.js';
import { output, runSafely } from '../output.js';

@Command( {
    name: 'user:promote',
    arguments: '<email>',
    description: 'Make a user a superadmin (or a normal user again, with --demote)',
} )
export class UserPromoteCommand extends CommandRunner {
    constructor( private readonly database: DatabaseService ) {
        super();
    }

    @Option( { flags: '--demote', description: 'Make them a normal user again' } )
    parseDemote(): boolean {
        return true;
    }

    async run( [ email ]: string[], options: { demote?: boolean } ): Promise<void> {
        await runSafely( async () => {
            const address = email.trim().toLowerCase();
            const role = options.demote ? PlatformRole.ApplicationUser : PlatformRole.Superadmin;
            const changed = await this.database.withDataSource( async ( dataSource ) => {
                const users = dataSource.getRepository( User );
                const user = await users.findOneBy( { email: address } );

                if ( !user ) {
                    throw new Error( `No user with the email ${address}.` );
                }
                if ( user.platformRole === role ) {
                    return false;
                }
                await users.update( { id: user.id }, { platformRole: role } );

                return true;
            } );

            if ( !changed ) {
                output.info( `${address} is already ${role}.` );

                return;
            }
            output.success( `${address} is now ${role}.` );
            // The role is in the access token, which is renewed from the database every few minutes.
            output.info( output.dim( 'It applies the next time their access token is renewed (JWT_EXPIRES_IN_SECONDS, 15 minutes by default) or they log in again.' ) );
        } );
    }
}
