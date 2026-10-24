import { registerAs } from '@nestjs/config';

import { validateEnv } from './env.js';

/** Inject with `@Inject( databaseConfig.KEY )`. */
export const databaseConfig = registerAs( 'database', () => ( { url: validateEnv( process.env ).DATABASE_URL } ) );
