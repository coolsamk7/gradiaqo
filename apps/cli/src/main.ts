import 'reflect-metadata';

import { CommandFactory } from 'nest-commander';

import { AppModule } from './app.module.js';

// Only warnings and errors from Nest itself; commands print their own output.
await CommandFactory.run( AppModule, { logger: [ 'warn', 'error' ] } );
