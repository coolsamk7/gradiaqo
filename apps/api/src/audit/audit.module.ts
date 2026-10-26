import { Global, Module } from '@nestjs/common';

import { AuditService } from './services/audit.service.js';

/** The audit log of superadmin actions. Global, because users, moderation and the catalog all record to it. */
@Global()
@Module( {
    providers: [ AuditService ],
    exports: [ AuditService ],
} )
export class AuditModule {}
