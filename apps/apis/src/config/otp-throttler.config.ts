import type { ThrottlerOptions } from '@nestjs/throttler';
import { registerAs } from '@nestjs/config';

export const OTP_THROTTLER_NAME = 'otp';
export const OTP_RATE_LIMIT_OPTIONS = {
    limit: 5,
    ttl: 10 * 60 * 1000,
} as const;

type OtpThrottlerConfig = {
    throttlers: Array<Pick<ThrottlerOptions, 'name' | 'limit' | 'ttl'>>;
};

function parsePositiveInteger( value: string | undefined, fallback: number, label: string ) {
    if ( !value?.trim() ) {
        return fallback;
    }

    const parsedValue = Number.parseInt( value, 10 );
    if ( !Number.isFinite( parsedValue ) || parsedValue <= 0 ) {
        throw new Error( `${label} must be a positive integer.` );
    }

    return parsedValue;
}

export const otpThrottlerConfig = registerAs( 'otp-throttler.config', (): OtpThrottlerConfig => {
    return {
        throttlers: [
            {
                name: OTP_THROTTLER_NAME,
                limit: parsePositiveInteger(
                    process.env['AUTH_OTP_RATE_LIMIT_LIMIT'],
                    OTP_RATE_LIMIT_OPTIONS.limit,
                    'AUTH_OTP_RATE_LIMIT_LIMIT'
                ),
                ttl: parsePositiveInteger(
                    process.env['AUTH_OTP_RATE_LIMIT_TTL_MS'],
                    OTP_RATE_LIMIT_OPTIONS.ttl,
                    'AUTH_OTP_RATE_LIMIT_TTL_MS'
                ),
            },
        ],
    };
} );
