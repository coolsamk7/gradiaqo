import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membership, Organization, OrganizationInvitation } from '@studylog/database';

import { MailModule } from '../mail/mail.module.js';
import { UsersModule } from '../users/users.module.js';
import { MyInvitationsController, OrganizationInvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';
import { OrganizationGuard } from './organization.guard.js';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';

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
