import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MigrationsModule } from './migrations/migrations.module.js';

@Module( {
    imports: [ ConfigModule.forRoot( { isGlobal: true } ), MigrationsModule ],
} )
export class AppModule {}
