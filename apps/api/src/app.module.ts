import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createDataSourceOptions } from '@studylog/database';
import { LoggerModule } from '@studylog/logger';

import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { validateEnv } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { ModerationModule } from './moderation/moderation.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { RATE_LIMITS } from './rate-limits.js';
import { StudyModule } from './study/study.module.js';
import { UsersModule } from './users/users.module.js';

@Module( {
    imports: [
        // Checks every setting at startup and converts them to numbers/booleans (see config/env.ts).
        ConfigModule.forRoot( { isGlobal: true, validate: validateEnv } ),
        LoggerModule.forRoot( { service: 'studylog-api', ignorePaths: [ '/docs', '/health' ] } ),
        ThrottlerModule.forRootAsync( {
            inject: [ ConfigService ],
            useFactory: ( config: ConfigService ) => ( {
                throttlers: [ { name: 'default', ...RATE_LIMITS.default } ],
                errorMessage: 'Too many requests; try again later',
                // Off only for the UI tests (apps/e2e), which log in far more often than people do.
                skipIf: () => !config.getOrThrow<boolean>( 'RATE_LIMITS_ENABLED' ),
            } ),
        } ),
        TypeOrmModule.forRootAsync( {
            inject: [ ConfigService ],
            // Shared with the CLI. The schema is changed only by migrations (`yarn cli migration:run`), never synchronize.
            useFactory: ( config: ConfigService ) => ( {
                ...createDataSourceOptions( { url: config.getOrThrow<string>( 'DATABASE_URL' ) } ),
                autoLoadEntities: true,
            } ),
        } ),
        UsersModule,
        AuthModule,
        OrganizationsModule,
        CatalogModule,
        StudyModule,
        ModerationModule,
        HealthModule,
    ],
    // Every route is rate limited per client IP (see rate-limits.ts).
    providers: [ { provide: APP_GUARD, useClass: ThrottlerGuard } ],
} )
export class AppModule {}
