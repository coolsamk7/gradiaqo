import { UseGuards, applyDecorators } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { OTP_RATE_LIMIT_OPTIONS } from 'src/config/otp-throttler.config';

type OtpRateLimitType = keyof typeof OTP_RATE_LIMIT_OPTIONS;

export function OtpRateLimit( type: OtpRateLimitType ) {
    const { name, limit, ttl } = OTP_RATE_LIMIT_OPTIONS[type];

    return applyDecorators(
        UseGuards( ThrottlerGuard ),
        Throttle( {
            [name]: { limit, ttl },
        } )
    );
}
