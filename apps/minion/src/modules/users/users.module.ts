import { UserEmailOtpEntity } from '@gradiaqo/nestjs-database/entities';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCreatedFunction } from './user-created.function';
import { UserOtpResendRequestedFunction } from './user-otp-resend-requested.function';
import { SmtpMailerService } from './services/smtp-mailer.service';
import { UserEmailOtpService } from './services/user-email-otp.service';

@Module( {
    imports: [ TypeOrmModule.forFeature( [ UserEmailOtpEntity ] ) ],
    providers: [ UserCreatedFunction, UserOtpResendRequestedFunction, SmtpMailerService, UserEmailOtpService ],
} )
export class UsersModule {}
