import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MigrationsModule } from './migrations/migrations.module.js';
import { SeedModule } from './seed/seed.module.js';

@Module( {
    imports: [ ConfigModule.forRoot( { isGlobal: true } ), MigrationsModule, SeedModule ],
} )
export class AppModule {}
