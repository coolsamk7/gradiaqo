import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { UserPromoteCommand } from './user-promote.command.js';

@Module( {
    imports: [ DatabaseModule ],
    providers: [ UserPromoteCommand ],
} )
export class UsersModule {}
