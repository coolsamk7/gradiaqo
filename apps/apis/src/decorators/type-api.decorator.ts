import { CallHandler, ExecutionContext, Injectable, NestInterceptor, UseInterceptors, applyDecorators } from '@nestjs/common';
import { ApiBody, ApiBodyOptions, ApiQuery, ApiQueryOptions, ApiResponse, ApiResponseOptions } from '@nestjs/swagger';
import type { Observable } from 'rxjs';
import { map } from 'rxjs';
import { TSchema } from 'typebox';
import { transformTypeboxResponse } from 'src/utils';

export type TypeApiBodyOptions = ApiBodyOptions & {
    schema?: TSchema;
};

export function TypeApiBody( { schema, ...rest }: TypeApiBodyOptions ) {
    return applyDecorators( ApiBody( { schema, ...rest } ) );
}

export type TypeApiQueryOptions = ApiQueryOptions & {
    schema?: TSchema;
};

export function TypeApiQuery( { ...options }: TypeApiQueryOptions ) {
    return applyDecorators( ApiQuery( options ) );
}

export type TypeApiResponseOptions = ApiResponseOptions & {
    schema: TSchema;
};

function createTypeApiResponseInterceptor<T extends TSchema>( schema: T ) {
    @Injectable()
    class TypeApiResponseInterceptor implements NestInterceptor {
        intercept( _context: ExecutionContext, next: CallHandler ): Observable<unknown> {
            return next.handle().pipe(
                map( ( response ) => transformTypeboxResponse( schema, response ) )
            );
        }
    }

    return TypeApiResponseInterceptor;
}

export function TypeApiResponse( { schema, ...rest }: TypeApiResponseOptions ) {
    return applyDecorators(
        UseInterceptors( createTypeApiResponseInterceptor( schema ) ),
        ApiResponse( { schema, ...rest } )
    );
}
