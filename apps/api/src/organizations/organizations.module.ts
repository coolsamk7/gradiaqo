import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membership, Organization } from '@studylog/database';

import { OrganizationGuard } from './organization.guard.js';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';

@Module( {
    imports: [ TypeOrmModule.forFeature( [ Organization, Membership ] ) ],
    controllers: [ OrganizationsController ],
    providers: [ OrganizationsService, OrganizationGuard ],
    exports: [ OrganizationsService, OrganizationGuard ],
} )
export class OrganizationsModule {}
