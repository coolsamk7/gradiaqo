import { Throttle } from '@nestjs/throttler';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Requests per client IP. The default applies to every route; the rest are tighter limits for routes that are
 * attractive to abuse (guessing passwords, mass signups, spam). Counters are kept in memory, so with several API
 * instances each counts separately: move them to a shared store (e.g. Redis) before scaling out.
 */
export const RATE_LIMITS = {
    default: { limit: 300, ttl: MINUTE },
    login: { limit: 10, ttl: MINUTE },
    signup: { limit: 10, ttl: HOUR },
    refresh: { limit: 60, ttl: MINUTE },
    sensitive: { limit: 5, ttl: 15 * MINUTE },
    // Entering emailed codes: room for typos; each code also stops working after a few wrong guesses.
    code: { limit: 20, ttl: 15 * MINUTE },
    invite: { limit: 30, ttl: HOUR },
    report: { limit: 10, ttl: HOUR },
} as const;

/** Replaces the default limit on a route, e.g. `@RateLimit( 'login' )`. */
export const RateLimit = ( name: Exclude<keyof typeof RATE_LIMITS, 'default'> ) =>
    Throttle( { default: RATE_LIMITS[name] } );
