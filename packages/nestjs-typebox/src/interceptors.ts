import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs';

import type { TypeboxSchema } from './schema.js';

export const TYPEBOX_RESPONSE_SCHEMA = 'nestjs-typebox:response-schema';

/**
 * Validates, encodes and strips handler results against the schema set by `@TypeboxResponse()` /
 * `@Validate( { response } )`. Unknown properties (e.g. a password hash on an entity) never reach the client.
 */
@Injectable()
export class TypeboxResponseInterceptor implements NestInterceptor {
    constructor( private readonly reflector: Reflector ) {}

    intercept( context: ExecutionContext, next: CallHandler ): Observable<unknown> {
        const schema = this.reflector.get<TypeboxSchema | undefined>( TYPEBOX_RESPONSE_SCHEMA, context.getHandler() );

        return schema ? next.handle().pipe( map( ( data ) => schema.parse( data ) ) ) : next.handle();
    }
}

/** @deprecated Renamed to `TypeboxResponseInterceptor`. */
export const TypeboxTransformInterceptor = TypeboxResponseInterceptor;
