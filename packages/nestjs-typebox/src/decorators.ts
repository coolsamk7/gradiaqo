import type { PipeTransform } from '@nestjs/common';
import { applyDecorators, Delete, Get, HttpCode, Patch, Post, Put, SetMetadata, UseInterceptors } from '@nestjs/common';
import { assignMetadata, ROUTE_ARGS_METADATA, RouteParamtypes } from '@nestjs/common/internal';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import type { StaticDecode, TSchema } from 'typebox';
import Type from 'typebox';

import { analyzeSchema } from './analyze-schema.js';
import { TYPEBOX_RESPONSE_SCHEMA, TypeboxResponseInterceptor } from './interceptors.js';
import type { TypeboxSchema } from './schema.js';
import { isTypeboxSchema, typebox, validatedByRoutePipe } from './schema.js';
import type {
    HttpEndpointDecoratorConfig,
    MethodDecorator,
    RequestConfigsToTypes,
    RequestValidatorConfig,
    ResponseValidatorConfig,
    SchemaValidator,
    SchemaValidatorConfig,
    ValidatorConfig,
} from './types.js';
import { capitalize } from './util.js';

export interface TypeboxResponseOptions {
    /** HTTP status this schema describes. Default: 200. */
    status?: number;
    description?: string;
    /** OpenAPI component name. Default: the schema's own name, if it has one. */
    name?: string;
    /** Strip properties not in the schema. Default: true. */
    stripUnknown?: boolean;
    example?: unknown;
}

/**
 * Documents a response with a TypeBox schema and enforces it: the handler's result is encoded
 * (e.g. `Date` → ISO string), stripped of unknown properties, and checked (mismatch → 500).
 *
 * @example
 * @Get( ':id' )
 * @TypeboxResponse( Cat )
 * findOne() {}
 */
export function TypeboxResponse( schema: TSchema | TypeboxSchema, options: TypeboxResponseOptions = {} ) {
    const { status = 200, description, example, stripUnknown = true } = options;
    const source = isTypeboxSchema( schema ) ? schema.schema : schema;
    const name = options.name ?? ( isTypeboxSchema( schema ) ? schema.name : undefined );
    const response = typebox( source, { name, direction: 'response', stripUnknown } );

    return applyDecorators(
        ApiResponse( { status, description: description ?? '', standardSchema: response, ...( example !== undefined && { example } ) } ),
        SetMetadata( TYPEBOX_RESPONSE_SCHEMA, response ),
        UseInterceptors( TypeboxResponseInterceptor ),
    );
}

// ---------------------------------------------------------------------------------------------
// nestjs-typebox v4 compatible API
// ---------------------------------------------------------------------------------------------

export function isSchemaValidator( type: unknown ): type is SchemaValidator {
    return isTypeboxSchema( type ) || ( typeof type === 'object' && type !== null && typeof ( type as SchemaValidator ).validate === 'function' );
}

/** v4 API. Prefer `typebox()` in new code. */
export function buildSchemaValidator( config: SchemaValidatorConfig ): SchemaValidator {
    const { type, schema, coerceTypes, stripUnknownProps, name, required } = config;

    if ( !type ) {
        throw new Error( 'Validator missing "type".' );
    }
    if ( !name ) {
        throw new Error( `Validator of type "${type}" missing name.` );
    }
    if ( !schema || !Type.IsSchema( schema ) ) {
        throw new Error( `Validator "${name}" expects a TypeBox schema.` );
    }

    const adapter = typebox( schema, {
        name,
        direction: type === 'response' ? 'response' : 'request',
        stripUnknown: stripUnknownProps,
        coerce: coerceTypes,
        ...( type !== 'response' && { location: type } ),
    } );

    return {
        schema,
        name,
        analysis: analyzeSchema( schema ),
        check: ( value ) => !adapter.safeParse( value ).issues,
        validate: ( data ) => ( data === undefined && !required ? undefined : adapter.parse( data ) ),
    };
}

/** v4 accepts either a bare schema or `{ schema, ...options }`; in TypeBox 1.x every object passes `IsSchema`, so check the shape. */
function toResponseConfig( response: ResponseValidatorConfig | TSchema ): ResponseValidatorConfig {
    return typeof response === 'object' && 'schema' in response && typeof response.schema === 'object'
        ? ( response )
        : { schema: response };
}

/**
 * v4 API: validates request params/query/body and the response, and documents them in OpenAPI.
 * Built on Nest 12 route metadata (`@nestjs/common/internal`) and Swagger's Standard Schema support.
 */
export function Validate<
    T extends TSchema,
    RequestValidators extends RequestValidatorConfig[],
    MethodDecoratorType extends (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...args: [ ...RequestConfigsToTypes<RequestValidators>, ...any[] ]
    ) => Promise<StaticDecode<T>> | StaticDecode<T>,
>( validatorConfig: ValidatorConfig<T, RequestValidators> ): MethodDecorator<MethodDecoratorType> {
    return ( target, key, descriptor ) => {
        const { response, request } = validatorConfig;
        const methodName = capitalize( String( key ) );
        let args = ( Reflect.getMetadata( ROUTE_ARGS_METADATA, target.constructor, key ) ?? {} ) as Record<
            string,
            unknown
        >;

        if ( response ) {
            const { schema, responseCode = 200, description, example, stripUnknownProps = true, name = `${methodName}Response` } =
                toResponseConfig( response );

            const options = { status: responseCode, description, example, name, stripUnknown: stripUnknownProps };

            TypeboxResponse( schema, options )( target, key, descriptor );
        }

        request?.forEach( ( config, index ) => {
            const pipes = config.pipes ?? [];

            switch ( config.type ) {
                case 'body': {
                    const { required = true, name = `${methodName}Body`, stripUnknownProps = false, coerceTypes = false } = config;
                    const schema = typebox( config.schema, {
                        name,
                        stripUnknown: stripUnknownProps,
                        coerce: coerceTypes,
                    } );

                    args = assignMetadata( args, RouteParamtypes.BODY, index, {
                        pipes: [ ...pipes, validationPipe( schema, required ) ],
                        schema,
                    } );
                    break;
                }

                case 'param':
                case 'query': {
                    const isParam = config.type === 'param';
                    const { required = isParam, coerceTypes = true, schema: source = Type.String() } = config;
                    const schema = typebox( source, { coerce: coerceTypes, location: config.type } );

                    args = assignMetadata( args, isParam ? RouteParamtypes.PARAM : RouteParamtypes.QUERY, index, {
                        data: config.name,
                        pipes: [ ...pipes, validationPipe( schema, required ) ],
                        schema,
                    } );
                    if ( !isParam ) {
                        // Swagger infers params from the schema, but not whether a query is optional.
                        const query = { name: config.name, required, schema: schema.toJsonSchema() };

                        ApiQuery( query )( target, key, descriptor );
                    }
                    break;
                }
            }
        } );

        Reflect.defineMetadata( ROUTE_ARGS_METADATA, args, target.constructor, key );

        return descriptor;
    };
}

function validationPipe( schema: TypeboxSchema, required: boolean ): PipeTransform {
    validatedByRoutePipe.add( schema );

    return {
        transform: ( value: unknown ) => ( value === undefined && !required ? undefined : schema.parse( value ) ),
    };
}

const nestHttpDecoratorMap = { GET: Get, POST: Post, PATCH: Patch, DELETE: Delete, PUT: Put };

/** v4 API: route + status code + OpenAPI operation + `@Validate()` in one decorator. */
export const HttpEndpoint = <
    S extends TSchema,
    RequestConfigs extends RequestValidatorConfig[],
    MethodDecoratorType extends (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...args: [ ...RequestConfigsToTypes<RequestConfigs>, ...any[] ]
    ) => Promise<StaticDecode<S>> | StaticDecode<S>,
>(
    config: HttpEndpointDecoratorConfig<S, RequestConfigs>,
): MethodDecorator<MethodDecoratorType> => {
    const { method, responseCode = 200, path, validate, ...apiOperationOptions } = config;
    const decorators: MethodDecorator[] = [
        nestHttpDecoratorMap[method]( path ),
        HttpCode( responseCode ),
        ApiOperation( apiOperationOptions ),
    ];

    if ( path ) {
        const pathParams = path
            .split( '/' )
            .filter( ( segment ) => segment.startsWith( ':' ) )
            .map( ( segment ) => ( { name: segment.replace( /^:([^?]+)\??$/, '$1' ), required: !segment.endsWith( '?' ) } ) );

        for ( const pathParam of pathParams ) {
            const paramValidator = validate?.request?.find( ( validator ) => validator.name === pathParam.name );

            if ( !paramValidator ) {
                throw new Error( `Path param "${pathParam.name}" is missing a request validator.` );
            }
            if ( paramValidator.required === false && pathParam.required ) {
                throw new Error( `Optional path param "${pathParam.name}" is required in validator.` );
            }
        }

        const missingPathParam = validate?.request?.find(
            ( validator ) => validator.type === 'param' && !pathParams.some( ( param ) => param.name === validator.name ),
        );

        if ( missingPathParam ) {
            throw new Error( `Request validator references non-existent path parameter "${missingPathParam.name}".` );
        }
    }

    if ( validate ) {
        // v4 documented the response under 200 even when the endpoint returns e.g. 201; use the endpoint's code.
        const response = validate.response && toResponseConfig( validate.response );

        decorators.push( Validate( response ? { ...validate, response: { responseCode, ...response } } : validate ) );
    }

    return applyDecorators( ...decorators );
};
