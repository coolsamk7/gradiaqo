import { applyDecorators, Body } from '@nestjs/common';
import { ApiBody, ApiBodyOptions, ApiQuery, ApiQueryOptions, ApiResponse, ApiResponseOptions } from '@nestjs/swagger';
import { TSchema } from 'typebox';

export type TypeApiBodyOptions = ApiBodyOptions & {
    schema?: TSchema;
};

export function TypeApiBody( { schema, ...rest }: TypeApiBodyOptions ) {
    return applyDecorators( Body, ApiBody( { schema, ...rest } ) );
}

export type TypeApiQueryOptions = ApiQueryOptions & {
    schema?: TSchema;
};

export function TypeApiQuery( { ...options }: TypeApiBodyOptions ) {
    return applyDecorators( ApiQuery( options ) );
}

export type TypeApiResponseOptions = ApiResponseOptions & {
    schema: TSchema;
};

export function TypeApiResponse( options: TypeApiResponseOptions ) {
    return applyDecorators( ApiResponse( options ) );
}

