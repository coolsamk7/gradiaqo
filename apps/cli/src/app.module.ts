import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CatalogModule } from './catalog/catalog.module.js';
import { MigrationsModule } from './migrations/migrations.module.js';
import { SeedModule } from './seed/seed.module.js';
import { UsersModule } from './users/users.module.js';

@Module( {
    imports: [ ConfigModule.forRoot( { isGlobal: true } ), MigrationsModule, SeedModule, UsersModule, CatalogModule ],
} )
export class AppModule {}
