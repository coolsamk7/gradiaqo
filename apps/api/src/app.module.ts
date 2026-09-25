import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createDataSourceOptions } from '@studylog/database';
import { LoggerModule } from '@studylog/logger';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { StudyModule } from './study/study.module.js';
import { UsersModule } from './users/users.module.js';

@Module( {
    imports: [
        ConfigModule.forRoot( { isGlobal: true } ),
        LoggerModule.forRoot( { service: 'studylog-api', ignorePaths: [ '/docs' ] } ),
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
    ],
    controllers: [ AppController ],
    providers: [ AppService ],
} )
export class AppModule {}
