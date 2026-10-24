import { Module } from '@nestjs/common';

import { MailService } from './services/mail.service.js';

@Module( {
    providers: [ MailService ],
    exports: [ MailService ],
} )
export class MailModule {}
