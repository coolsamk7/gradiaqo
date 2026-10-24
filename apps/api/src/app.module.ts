import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createDataSourceOptions } from '@studylog/database';
import { LoggerModule } from '@studylog/logger';

import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { appConfig } from './config/app.config.js';
import { authConfig } from './config/auth.config.js';
import { refreshCookieConfig } from './config/cookie.config.js';
import { databaseConfig } from './config/database.config.js';
import { validateEnv } from './config/env.js';
import { mailConfig } from './config/mail.config.js';
import { HealthModule } from './health/health.module.js';
import { ModerationModule } from './moderation/moderation.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { RATE_LIMITS } from './rate-limits.js';
import { StudyModule } from './study/study.module.js';
import { UsersModule } from './users/users.module.js';

@Module( {
    imports: [
        // Checks every setting at startup (see config/env.ts), then offers them typed, by area: inject
        // `@Inject( mailConfig.KEY ) mail: ConfigType<typeof mailConfig>`.
        ConfigModule.forRoot( {
            isGlobal: true,
            validate: validateEnv,
            load: [ appConfig, authConfig, databaseConfig, mailConfig, refreshCookieConfig ],
        } ),
        LoggerModule.forRoot( { service: 'studylog-api', ignorePaths: [ '/docs', '/health' ] } ),
        ThrottlerModule.forRootAsync( {
            inject: [ appConfig.KEY ],
            useFactory: ( app: ConfigType<typeof appConfig> ) => ( {
                throttlers: [ { name: 'default', ...RATE_LIMITS.default } ],
                errorMessage: 'Too many requests; try again later',
                // Off only for the UI tests (apps/e2e), which log in far more often than people do.
                skipIf: () => !app.rateLimitsEnabled,
            } ),
        } ),
        TypeOrmModule.forRootAsync( {
            inject: [ databaseConfig.KEY ],
            // Shared with the CLI. The schema is changed only by migrations (`yarn cli migration:run`), never synchronize.
            useFactory: ( database: ConfigType<typeof databaseConfig> ) => ( {
                ...createDataSourceOptions( { url: database.url } ),
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
