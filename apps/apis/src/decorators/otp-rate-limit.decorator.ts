import { UseGuards, applyDecorators } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { OTP_RATE_LIMIT_OPTIONS, OTP_THROTTLER_NAME } from 'src/config/otp-throttler.config';

export function OtpRateLimit() {
    return applyDecorators(
        UseGuards( ThrottlerGuard ),
        Throttle( {
            [OTP_THROTTLER_NAME]: OTP_RATE_LIMIT_OPTIONS,
        } )
    );
}
