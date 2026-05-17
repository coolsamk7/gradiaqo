import type { Static, TSchema } from 'typebox';
import { Assert, Clone, Convert } from 'typebox/value';

type MutableSchema = TSchema & {
    type?: string;
    properties?: Record<string, TSchema>;
    items?: TSchema;
    anyOf?: TSchema[];
    allOf?: TSchema[];
    oneOf?: TSchema[];
    not?: TSchema;
    additionalProperties?: boolean;
};

function closeObjectSchemas<T extends TSchema>( schema: T ): T {
    const nextSchema = { ...schema } as MutableSchema;

    if ( nextSchema.type === 'object' && nextSchema.properties ) {
        nextSchema.additionalProperties = false;
        nextSchema.properties = Object.fromEntries(
            Object.entries( nextSchema.properties ).map( ( [ key, value ] ) => [ key, closeObjectSchemas( value ) ] )
        );
    }

    if ( nextSchema.items ) {
        nextSchema.items = closeObjectSchemas( nextSchema.items );
    }

    if ( nextSchema.anyOf ) {
        nextSchema.anyOf = nextSchema.anyOf.map( closeObjectSchemas );
    }

    if ( nextSchema.allOf ) {
        nextSchema.allOf = nextSchema.allOf.map( closeObjectSchemas );
    }

    if ( nextSchema.oneOf ) {
        nextSchema.oneOf = nextSchema.oneOf.map( closeObjectSchemas );
    }

    if ( nextSchema.not ) {
        nextSchema.not = closeObjectSchemas( nextSchema.not );
    }

    return nextSchema as T;
}

export function transformTypeboxResponse<T extends TSchema>( schema: T, response: unknown ): Static<T> {
    const normalizedSchema = closeObjectSchemas( schema );
    const transformedResponse = Convert( normalizedSchema, Clone( response ) );

    Assert( normalizedSchema, transformedResponse );

    return transformedResponse as Static<T>;
}
