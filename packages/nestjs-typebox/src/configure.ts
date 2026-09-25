import type { Configure } from './types.js';

/**
 * @deprecated No longer needed in v5 and does nothing:
 * - Swagger works through NestJS 12's Standard Schema support, so there's nothing to patch.
 * - TypeBox 1.x ships the `email`, `uuid`, `url`, `date`, `time` and `date-time` formats.
 * - Per-schema `errorMessage` is applied when formatting errors, without a global error function.
 */
export const configureNestJsTypebox = ( _options?: Configure ): void => undefined;
