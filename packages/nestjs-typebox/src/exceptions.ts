import { BadRequestException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { TypeboxValidationIssue } from './errors.js';

export type ValidatorType = 'body' | 'query' | 'param' | 'response';

/**
 * Thrown when a request fails validation (400).
 *
 * Body: `{ statusCode: 400, message: 'Validation failed (body)', errors: [ { path, message, keyword } ] }`
 */
export class TypeboxValidationException extends BadRequestException {
    constructor(
        readonly type: Exclude<ValidatorType, 'response'>,
        readonly issues: TypeboxValidationIssue[],
    ) {
        super( {
            statusCode: HttpStatus.BAD_REQUEST,
            message: `Validation failed (${type})`,
            errors: issues,
        } );
    }
}

/**
 * Thrown when a handler returns data that doesn't match its response schema (500): a server bug,
 * so the details are logged by Nest but not sent to the client.
 */
export class TypeboxResponseValidationException extends InternalServerErrorException {
    constructor( readonly issues: TypeboxValidationIssue[] ) {
        super( 'Response validation failed', { cause: issues } );
    }
}

/**
 * `exceptionFactory` for Nest's built-in `StandardSchemaValidationPipe`, so its errors use the same
 * shape as the rest of this library.
 *
 * @example
 * app.useGlobalPipes( new StandardSchemaValidationPipe( { exceptionFactory: typeboxExceptionFactory } ) );
 */
export function typeboxExceptionFactory( issues: readonly StandardSchemaV1.Issue[] ): BadRequestException {
    return new BadRequestException( {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        errors: issues.map( ( issue ) => ( {
            path: issue.path?.length
                ? `/${issue.path.map( ( segment ) => String( typeof segment === 'object' ? segment.key : segment ) ).join( '/' )}`
                : '',
            message: issue.message,
        } ) ),
    } );
}
