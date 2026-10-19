import { ConfigService } from '@nestjs/config';
import { User } from '@studylog/database';
import * as argon2 from 'argon2';
import { Command, CommandRunner, Option } from 'nest-commander';
import { In } from 'typeorm';

import { DatabaseService } from '../database/database.service.js';
import { output, runSafely } from '../output.js';
import { SEED_PASSWORD, USERS } from './seed-content.js';
import { buildSeedData, seedTables } from './seed-data.js';

@Command( {
    name: 'db:seed',
    description: 'Fill the database with dummy data for development (users, organizations, catalog, progress, ...)',
} )
export class SeedCommand extends CommandRunner {
    constructor(
        private readonly database: DatabaseService,
        private readonly config: ConfigService,
    ) {
        super();
    }

    @Option( { flags: '--reset', description: 'Delete ALL existing data first (the schema and migrations are kept)' } )
    parseReset(): boolean {
        return true;
    }

    async run( _params: string[], options: { reset?: boolean } ): Promise<void> {
        await runSafely( async () => {
            if ( this.config.get<string>( 'NODE_ENV' ) === 'production' ) {
                throw new Error( 'Refusing to seed: NODE_ENV is production.' );
            }

            const data = buildSeedData( { now: new Date(), passwordHash: await argon2.hash( SEED_PASSWORD ) } );
            const tables = seedTables( data );

            // All or nothing: a failure leaves the database as it was.
            await this.database.withDataSource( ( dataSource ) => dataSource.transaction( async ( manager ) => {
                if ( options.reset ) {
                    const names = dataSource.entityMetadatas.map( ( metadata ) => `"${metadata.tableName}"` );

                    await manager.query( `TRUNCATE ${names.join( ', ' )} CASCADE` );
                } else if ( await manager.existsBy( User, { email: In( USERS.map( ( user ) => user.email ) ) } ) ) {
                    throw new Error( 'The dummy users already exist. Run `yarn cli db:seed --reset` to start over (deletes ALL data).' );
                }
                for ( const table of tables ) {
                    await manager.insert( table.entity, table.rows );
                }
            } ) );

            if ( options.reset ) {
                output.warn( 'Deleted all existing data.' );
            }
            for ( const table of tables ) {
                output.success( `${table.rows.length} ${table.name}` );
            }
            output.info( `\nLog in with password ${SEED_PASSWORD} as:` );
            for ( const user of USERS ) {
                output.info( `  ${user.email.padEnd( 20 )}${output.dim( user.platformRole )}` );
            }
        } );
    }
}
