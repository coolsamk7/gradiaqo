import { ArgumentMetadata, BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor, PipeTransform, UseInterceptors, UsePipes, applyDecorators } from '@nestjs/common';
import { ApiBody, ApiBodyOptions, ApiQuery, ApiQueryOptions, ApiResponse, ApiResponseOptions } from '@nestjs/swagger';
import type { Observable } from 'rxjs';
import { map } from 'rxjs';
import { TSchema } from 'typebox';
import { transformTypeboxValue } from 'src/utils';

export type TypeApiBodyOptions = ApiBodyOptions & {
    schema?: TSchema;
};

function createTypeApiBodyPipe<T extends TSchema>( schema: T ) {
    @Injectable()
    class TypeApiBodyPipe implements PipeTransform {
        transform( value: unknown, metadata: ArgumentMetadata ): unknown {
            if ( metadata.type !== 'body' ) {
                return value;
            }

            try {
                return transformTypeboxValue( schema, value );
            } catch {
                throw new BadRequestException( 'Request body does not match the expected schema.' );
            }
        }
    }

    return new TypeApiBodyPipe();
}

export function TypeApiBody( { schema, ...rest }: TypeApiBodyOptions ) {
    const decorators = [ ApiBody( { schema, ...rest } ) ];

    if ( schema ) {
        decorators.push( UsePipes( createTypeApiBodyPipe( schema ) ) );
    }

    return applyDecorators( ...decorators );
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
                map( ( response ) => transformTypeboxValue( schema, response ) )
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
