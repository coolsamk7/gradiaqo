import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@studylog/database';

import { UsersService } from './services/users.service.js';

@Module( {
    imports: [ TypeOrmModule.forFeature( [ User ] ) ],
    providers: [ UsersService ],
    exports: [ UsersService ],
} )
export class UsersModule {}
