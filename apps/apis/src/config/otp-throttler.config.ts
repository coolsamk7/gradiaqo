import type { ThrottlerOptions } from '@nestjs/throttler';
import { registerAs } from '@nestjs/config';

export const OTP_SIGNUP_THROTTLER_NAME = 'otp-signup';
export const OTP_RESEND_THROTTLER_NAME = 'otp-resend';
export const OTP_VERIFY_THROTTLER_NAME = 'otp-verify';

export const OTP_RATE_LIMIT_OPTIONS = {
    signup: {
        name: OTP_SIGNUP_THROTTLER_NAME,
        limit: 5,
        ttl: 10 * 60 * 1000,
    },
    resend: {
        name: OTP_RESEND_THROTTLER_NAME,
        limit: 5,
        ttl: 10 * 60 * 1000,
    },
    verify: {
        name: OTP_VERIFY_THROTTLER_NAME,
        limit: 10,
        ttl: 10 * 60 * 1000,
    },
} as const;

type OtpRateLimitKey = keyof typeof OTP_RATE_LIMIT_OPTIONS;

type OtpThrottlerConfig = {
    throttlers: Array<Pick<ThrottlerOptions, 'name' | 'limit' | 'ttl'>>;
};

function parsePositiveInteger( value: string | undefined, fallback: number, label: string ) {
    const trimmedValue = value?.trim();
    if ( !trimmedValue ) {
        return fallback;
    }

    if ( !/^\d+$/.test( trimmedValue ) ) {
        throw new Error( `${label} must be a positive integer.` );
    }

    const parsedValue = Number.parseInt( trimmedValue, 10 );
    if ( !Number.isFinite( parsedValue ) || parsedValue <= 0 ) {
        throw new Error( `${label} must be a positive integer.` );
    }

    return parsedValue;
}

function getOtpRateLimitOptions( key: OtpRateLimitKey ): Pick<ThrottlerOptions, 'name' | 'limit' | 'ttl'> {
    const config = OTP_RATE_LIMIT_OPTIONS[key];
    const envKeyPrefix = `AUTH_${key.toUpperCase()}_OTP_RATE_LIMIT`;

    return {
        name: config.name,
        limit: parsePositiveInteger(
            process.env[`${envKeyPrefix}_LIMIT`],
            config.limit,
            `${envKeyPrefix}_LIMIT`
        ),
        ttl: parsePositiveInteger(
            process.env[`${envKeyPrefix}_TTL_MS`],
            config.ttl,
            `${envKeyPrefix}_TTL_MS`
        ),
    };
}

export const otpThrottlerConfig = registerAs( 'otp-throttler.config', (): OtpThrottlerConfig => {
    return {
        throttlers: [
            getOtpRateLimitOptions( 'signup' ),
            getOtpRateLimitOptions( 'resend' ),
            getOtpRateLimitOptions( 'verify' ),
        ],
    };
} );
