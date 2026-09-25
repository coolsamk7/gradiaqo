import type { TCodec, TNull, TString, TUnion } from 'typebox';
import Type from 'typebox';

/** ISO 8601 date-time on the wire, `Date` in code. */
export const IsoDate = (): TCodec<TString, Date> =>
    Type.Codec( Type.String( { format: 'date-time' } ) )
        .Decode( ( value ) => new Date( value ) )
        .Encode( ( value ) => value.toISOString() );

/**
 * `IsoDate()` or null. Use this rather than `Type.Union( [ IsoDate(), Type.Null() ] )`: encoding a codec inside
 * a union fails on null.
 */
export const NullableIsoDate = (
    options: { description?: string } = {},
): TCodec<TUnion<[ TString, TNull ]>, Date | null> =>
    Type.Codec( Type.Union( [ Type.String( { format: 'date-time' } ), Type.Null() ], options ) )
        .Decode( ( value ) => ( value === null ? null : new Date( value ) ) )
        .Encode( ( value ) => ( value === null ? null : value.toISOString() ) );

/**
 * An email, trimmed and lowercased when decoded, so lookups are case-insensitive.
 * Surrounding spaces are allowed on the wire because they're removed by the decode step.
 */
export const Email = (): TCodec<TString, string> =>
    Type.Codec(
        Type.String( {
            maxLength: 255,
            pattern: '^\\s*[^\\s@]+@[^\\s@]+\\.[^\\s@]+\\s*$',
            errorMessage: 'must be a valid email address',
            examples: [ 'sameer@example.com' ],
        } ),
    )
        .Decode( ( value ) => value.trim().toLowerCase() )
        .Encode( ( value ) => value );

/** A required piece of text, trimmed when decoded. Must contain at least one non-space character. */
export const TrimmedText = ( maxLength: number, examples?: string[] ): TCodec<TString, string> =>
    Type.Codec(
        Type.String( {
            maxLength,
            pattern: '\\S',
            errorMessage: `must be between 1 and ${maxLength} characters`,
            ...( examples && { examples } ),
        } ),
    )
        .Decode( ( value ) => value.trim() )
        .Encode( ( value ) => value );

export const Uuid = () => Type.String( { format: 'uuid', examples: [ '97f12719-9f4c-41c9-afc3-a91de613d02b' ] } );
