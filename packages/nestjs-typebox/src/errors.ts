import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { TSchema } from 'typebox';
import type { TLocalizedValidationError } from 'typebox/error';

/** One validation problem, as returned in the `errors` array of a 400 response. */
export interface TypeboxValidationIssue {
    /** JSON pointer to the invalid value, e.g. `/email` or `/items/0/name`. Empty for the root. */
    path: string;
    message: string;
    /** The JSON Schema keyword that failed, e.g. `format`, `minLength`, `required`. */
    keyword: string;
}

/**
 * Turns TypeBox errors into readable issues:
 * - a missing-properties error becomes one issue per missing property, pointing at it
 * - an unknown property (`additionalProperties: false`) is reported at that property: "is not allowed"
 * - a union reports one issue ("must be one of 'a', 'b'" for literal unions), not one per branch
 * - a schema's own `errorMessage` (upstream nestjs-typebox feature) replaces the default message
 */
export function toIssues( schema: TSchema, errors: TLocalizedValidationError[] ): TypeboxValidationIssue[] {
    // Branch errors of a failed union are noise next to the union's own error.
    const unionPaths = errors
        .filter( ( error ) => error.keyword === 'anyOf' || error.keyword === 'oneOf' )
        .map( ( error ) => `${error.schemaPath}/${error.keyword}/` );
    const issues: TypeboxValidationIssue[] = [];

    for ( const error of errors ) {
        if ( unionPaths.some( ( path ) => error.schemaPath.startsWith( path ) ) ) {
            continue;
        }

        const custom = customMessage( schema, error.schemaPath );

        switch ( error.keyword ) {
            case 'required': {
                // A missing property is the *object's* error: the property's own errorMessage (about its
                // format) doesn't apply, but the object's does.
                const missing = ( error.params as { requiredProperties?: string[] } ).requiredProperties ?? [];

                for ( const property of missing ) {
                    issues.push( {
                        path: `${error.instancePath}/${escapePointer( property )}`,
                        message: custom ?? 'is required',
                        keyword: 'required',
                    } );
                }
                break;
            }

            // Reported per property by the `boolean` (`additionalProperties: false`) errors below.
            case 'additionalProperties':
                break;

            case 'boolean':
                issues.push(
                    error.schemaPath.endsWith( '/additionalProperties' )
                        ? { path: error.instancePath, message: 'is not allowed', keyword: 'additionalProperties' }
                        : { path: error.instancePath, message: custom ?? error.message, keyword: error.keyword },
                );
                break;

            case 'anyOf':
            case 'oneOf':
                issues.push( {
                    path: error.instancePath,
                    message: custom ?? literalUnionMessage( schema, error.schemaPath ) ?? error.message,
                    keyword: error.keyword,
                } );
                break;

            default:
                issues.push( { path: error.instancePath, message: custom ?? error.message, keyword: error.keyword } );
        }
    }

    return issues;
}

/** "must be one of 'S', 'M'" when every branch of the union is a literal. */
function literalUnionMessage( schema: TSchema, schemaPath: string ): string | undefined {
    const node = schemaAt( schema, schemaPath ) as { anyOf?: unknown[]; oneOf?: unknown[] } | undefined;
    const branches = node?.anyOf ?? node?.oneOf ?? [];
    const values = branches.map( ( branch ) => ( branch as { const?: unknown } | null )?.const );

    return values.length > 0 && values.every( ( value ) => value !== undefined )
        ? `must be one of ${values.map( ( value ) => JSON.stringify( value ).replaceAll( '"', '\'' ) ).join( ', ' )}`
        : undefined;
}

/** Standard Schema issues use a path array instead of a JSON pointer. */
export function toStandardIssues( issues: TypeboxValidationIssue[] ): StandardSchemaV1.Issue[] {
    return issues.map( ( { path, message } ) => ( {
        message,
        path: path === ''
            ? undefined
            : path.slice( 1 ).split( '/' ).map( unescapePointer )
                    .map( toKey ),
    } ) );
}

/** Reads `errorMessage` from the schema node at a `#/properties/...` style schema path. */
function customMessage( schema: TSchema, schemaPath: string ): string | undefined {
    const message = ( schemaAt( schema, schemaPath ) as { errorMessage?: unknown } | undefined )?.errorMessage;

    return typeof message === 'string' ? message : undefined;
}

/** The schema node a `#/...` JSON pointer points to. */
function schemaAt( schema: TSchema, schemaPath: string ): unknown {
    let node: unknown = schema;

    for ( const segment of schemaPath.replace( /^#\/?/, '' ).split( '/' ).filter( Boolean ) ) {
        if ( node === null || typeof node !== 'object' ) {
            return undefined;
        }
        node = ( node as Record<string, unknown> )[unescapePointer( segment )];
    }

    return node;
}

function escapePointer( segment: string ): string {
    return segment.replaceAll( '~', '~0' ).replaceAll( '/', '~1' );
}

function unescapePointer( segment: string ): string {
    return segment.replaceAll( '~1', '/' ).replaceAll( '~0', '~' );
}

function toKey( segment: string ): PropertyKey {
    return /^\d+$/.test( segment ) ? Number( segment ) : segment;
}
