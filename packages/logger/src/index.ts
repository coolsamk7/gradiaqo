export type { LoggerModuleOptions } from './logger.module.js';
export { LoggerModule } from './logger.module.js';
export type { LoggerOptions } from './logger-options.js';
export { createLoggerOptions, REQUEST_ID_HEADER } from './logger-options.js';
// Re-exported so apps only depend on @studylog/logger.
export { InjectPinoLogger, Logger, PinoLogger } from 'nestjs-pino';
