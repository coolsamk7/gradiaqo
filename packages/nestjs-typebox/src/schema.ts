import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';
import type { StaticDecode, StaticEncode, TSchema } from 'typebox';
import { Compile } from 'typebox/compile';
import Value from 'typebox/value';

import { analyzeSchema } from './analyze-schema.js';
import type { TypeboxValidationIssue } from './errors.js';
import { toIssues, toStandardIssues } from './errors.js';
import type { ValidatorType } from './exceptions.js';
import { TypeboxResponseValidationException, TypeboxValidationException } from './exceptions.js';

export const VENDOR = 'typebox';

export interface TypeboxSchemaOptions {
    /**
     * Name of the OpenAPI component (`#/components/schemas/<name>`). Without a name the schema is
     * inlined wherever it's used.
     */
    name?: string;
    /**
     * `request` (default) decodes incoming values; `response` encodes outgoing values (e.g. `Date`
     * → ISO string via `IsoDate()`) and strips unknown properties by default.
     */
    direction?: 'request' | 'response';
    /** Remove properties not in the schema before checking. Default: false for requests, true for responses. */
    stripUnknown?: boolean;
    /** Convert strings to numbers/booleans etc. where the schema expects them (query/path params). Default: false. */
    coerce?: boolean;
    /** Used in error messages: `Validation failed (<location>)`. Default: `body`. */
    location?: Exclude<ValidatorType, 'response'>;
}

type Direction = NonNullable<TypeboxSchemaOptions['direction']>;
type Output<T extends TSchema, D extends Direction> = D extends 'response' ? StaticEncode<T> : StaticDecode<T>;
type Input<T extends TSchema, D extends Direction> = D extends 'response' ? StaticDecode<T> : StaticEncode<T>;

export type TypeboxValidationResult<T> = { value: T; issues?: undefined } | { issues: TypeboxValidationIssue[] };

/**
 * A TypeBox schema wrapped as a Standard Schema, which NestJS 12 understands natively:
 * `@Body( { schema } )`, `@Query( { schema } )`, `@Param( 'id', { schema } )`, `@SerializeOptions( { schema } )`
 * and Swagger's `@ApiResponse( { standardSchema } )`.
 */
export interface TypeboxSchema<T extends TSchema = TSchema, D extends Direction = 'request'> {
    readonly '~standard': StandardSchemaV1.Props<Input<T, D>, Output<T, D>>
        & StandardJSONSchemaV1.Props<Input<T, D>, Output<T, D>>;
    /** The TypeBox schema. */
    readonly schema: T;
    readonly name: string | undefined;
    readonly direction: D;
    /** Validates (applying defaults, stripping, coercion, codecs) and returns the issues instead of throwing. */
    safeParse( value: unknown ): TypeboxValidationResult<Output<T, D>>;
    /** Validates and returns the result, or throws `TypeboxValidationException` (400) / `TypeboxResponseValidationException` (500). */
    parse( value: unknown ): Output<T, D>;
    /** Plain JSON Schema, e.g. for OpenAPI. */
    toJsonSchema(): Record<string, unknown>;
}

/**
 * Schemas that `@Validate()` / `@HttpEndpoint()` validate with their own parameter pipe. They are still
 * attached to the route for OpenAPI, so the global `TypeboxValidationPipe` must skip them; validating
 * twice would decode codecs twice.
 */
export const validatedByRoutePipe = new WeakSet<TypeboxSchema>();

export function isTypeboxSchema( value: unknown ): value is TypeboxSchema {
    return (
        typeof value === 'object'
        && value !== null
        && ( value as Partial<TypeboxSchema> )['~standard']?.vendor === VENDOR
        && 'schema' in value
    );
}

/**
 * Wraps a TypeBox schema for use with NestJS.
 *
 * @example
 * const CreateCat = typebox( Type.Object( { name: Type.String() } ), { name: 'CreateCat' } );
 *
 * @Post()
 * create( @Body( { schema: CreateCat } ) body: Static<typeof CreateCat.schema> ) {}
 */
export function typebox<const T extends TSchema, D extends Direction = 'request'>(
    schema: T,
    options: TypeboxSchemaOptions & { direction?: D } = {},
): TypeboxSchema<T, D> {
    const {
        name,
        direction = 'request' as D,
        stripUnknown = direction === 'response',
        coerce = false,
        location = 'body',
    } = options;
    const validator = Compile( schema );
    const { hasCodec, hasDefault } = analyzeSchema( schema );
    // Defaults, cleaning and conversion mutate their input; never touch the caller's objects.
    const needsCopy = hasDefault || stripUnknown || coerce || hasCodec;

    const safeParse = ( input: unknown ): TypeboxValidationResult<Output<T, D>> => {
        let value = needsCopy ? Value.Clone( input ) : input;

        if ( hasDefault ) {
            value = validator.Default( value );
        }
        if ( stripUnknown ) {
            value = validator.Clean( value );
        }
        if ( coerce ) {
            value = validator.Convert( value );
        }
        if ( direction === 'response' && hasCodec ) {
            // Handlers return decoded values (e.g. Date); encode them before checking the wire format.
            try {
                value = validator.Encode( value );
            } catch {
                // Fall through: Check reports what's wrong.
            }
        }
        if ( !validator.Check( value ) ) {
            return { issues: toIssues( schema, validator.Errors( value ) ) };
        }
        if ( direction === 'request' && hasCodec ) {
            value = validator.Decode( value );
        }

        return { value: value as Output<T, D> };
    };

    let jsonSchema: Record<string, unknown> | undefined;

    const toJsonSchema = () => ( jsonSchema ??= toPlainJsonSchema( schema ) );

    // Named schemas are emitted as a `$ref` + `$defs`, which Swagger turns into a named component.
    const convert = () => ( name ? { $ref: `#/$defs/${name}`, $defs: { [name]: toJsonSchema() } } : toJsonSchema() );

    return {
        schema,
        name,
        direction,
        safeParse,
        parse( input ) {
            const result = safeParse( input );

            if ( result.issues ) {
                throw direction === 'response'
                    ? new TypeboxResponseValidationException( result.issues )
                    : new TypeboxValidationException( location, result.issues );
            }

            return result.value;
        },
        toJsonSchema,
        '~standard': {
            version: 1,
            vendor: VENDOR,
            validate( input ) {
                const result = safeParse( input );

                return result.issues ? { issues: toStandardIssues( result.issues ) } : { value: result.value };
            },
            jsonSchema: { input: convert, output: convert },
        },
    };
}

// Keys this library reads but that aren't JSON Schema; kept out of the OpenAPI document.
const NON_STANDARD_KEYS = new Set( [ 'errorMessage' ] );

/** Deep copy of the enumerable JSON Schema (drops TypeBox's internal `~kind` / `~codec` markers). */
function toPlainJsonSchema( schema: TSchema ): Record<string, unknown> {
    return JSON.parse(
        // Only string values: a *property* called `errorMessage` is an object (its schema) and must stay.
        JSON.stringify( schema, ( key, value: unknown ) =>
            NON_STANDARD_KEYS.has( key ) && typeof value === 'string' ? undefined : value ),
    ) as Record<string, unknown>;
}
