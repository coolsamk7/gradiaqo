import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membership, Organization, OrganizationInvitation } from '@studylog/database';

import { MailModule } from '../mail/mail.module.js';
import { UsersModule } from '../users/users.module.js';
import { MyInvitationsController, OrganizationInvitationsController } from './controllers/invitations.controller.js';
import { OrganizationsController } from './controllers/organizations.controller.js';
import { OrganizationGuard } from './guards/organization.guard.js';
import { InvitationsService } from './services/invitations.service.js';
import { OrganizationsService } from './services/organizations.service.js';

@Module( {
    imports: [
        UsersModule,
        MailModule,
        TypeOrmModule.forFeature( [ Organization, Membership, OrganizationInvitation ] ),
    ],
    controllers: [ OrganizationsController, OrganizationInvitationsController, MyInvitationsController ],
    providers: [ OrganizationsService, OrganizationGuard, InvitationsService ],
    exports: [ OrganizationsService, OrganizationGuard ],
} )
export class OrganizationsModule {}
