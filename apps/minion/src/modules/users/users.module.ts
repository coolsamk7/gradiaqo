import { UserEmailOtpEntity } from '@gradiaqo/nestjs-database/entities';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCreatedFunction } from './user-created.function';
import { SmtpMailerService } from './services/smtp-mailer.service';
import { UserEmailOtpService } from './services/user-email-otp.service';

@Module( {
    imports: [ TypeOrmModule.forFeature( [ UserEmailOtpEntity ] ) ],
    providers: [ UserCreatedFunction, SmtpMailerService, UserEmailOtpService ],
} )
export class UsersModule {}
