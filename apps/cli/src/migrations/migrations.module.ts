import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import {
    MigrationCreateCommand,
    MigrationGenerateCommand,
    MigrationRevertCommand,
    MigrationRunCommand,
    MigrationShowCommand,
} from './migration.commands.js';

@Module( {
    imports: [ DatabaseModule ],
    providers: [
        MigrationGenerateCommand,
        MigrationCreateCommand,
        MigrationRunCommand,
        MigrationRevertCommand,
        MigrationShowCommand,
    ],
} )
export class MigrationsModule {}
