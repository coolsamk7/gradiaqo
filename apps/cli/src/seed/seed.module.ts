import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { SeedCommand } from './seed.command.js';

@Module( {
    imports: [ DatabaseModule ],
    providers: [ SeedCommand ],
} )
export class SeedModule {}
