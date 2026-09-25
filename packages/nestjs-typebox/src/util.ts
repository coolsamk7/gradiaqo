import type {
    Static,
    StaticDecode,
    TArray,
    TCodec,
    TEvaluate,
    TIntersect,
    TLiteral,
    TNull,
    TObject,
    TOmit,
    TOptional,
    TPartial,
    TPick,
    TSchema,
    TString,
    TUnion,
} from 'typebox';
import Type from 'typebox';

type SchemaOptions = Record<string, unknown>;
type StringOptions = Parameters<typeof Type.String>[0];

export type AllKeys<T> = T extends unknown ? Exclude<keyof T, symbol> : never;

export type Obj<T = unknown> = Record<string, T>;

export const capitalize = <S extends string>( str: S ): Capitalize<S> =>
    ( str.charAt( 0 ).toUpperCase() + str.slice( 1 ) ) as Capitalize<S>;

export const isObj = ( obj: unknown ): obj is Obj => obj !== null && typeof obj === 'object';

export type TUnionOfString<T extends string[], Acc extends TSchema[] = []> = T extends [
    infer L extends string,
    ...infer R extends string[],
]
    ? TUnionOfString<R, [ ...Acc, TLiteral<L> ]>
    : Acc;

/** `LiteralUnion( [ 'a', 'b' ] )` → `'a' | 'b'`. */
export const LiteralUnion = <const T extends string[]>(
    values: [ ...T ],
    options?: SchemaOptions,
): TUnion<TUnionOfString<T>> => Type.Union( values.map( ( value ) => Type.Literal( value ) ), options ) as never;

export type TPartialSome<T extends TSchema, K extends PropertyKey[]> = TEvaluate<
    TIntersect<[ TOmit<T, K>, TPartial<TPick<T, K>> ]>
>;

/** Makes only the given keys optional. (TypeBox 1.x removed `Type.Composite`; this uses `Type.Evaluate`.) */
export const PartialSome = <T extends TObject, K extends AllKeys<Static<T>>[]>(
    schema: T,
    keys: readonly [ ...K ],
    options?: SchemaOptions,
): TPartialSome<T, K> =>
    Type.Evaluate(
        Type.Intersect(
            [ Type.Omit( schema, keys as never ), Type.Partial( Type.Pick( schema, keys as never ) ) ],
            options,
        ),
    ) as never;

// Explicit return types: letting TypeScript infer TypeBox 1.x's generic Omit/Pick types
// exhausts memory while emitting declarations.
export const DistOmit = <T extends TSchema, K extends AllKeys<Static<T>>[]>(
    schema: T,
    keys: readonly [ ...K ],
    options?: SchemaOptions,
): TOmit<T, K> => Type.Omit( schema, keys as never, options ) as never;

export const DistPick = <T extends TSchema, K extends AllKeys<Static<T>>[]>(
    schema: T,
    keys: readonly [ ...K ],
    options?: SchemaOptions,
): TPick<T, K> => Type.Pick( schema, keys as never, options ) as never;

export const MaybeArray = <T extends TSchema>( schema: T, options?: SchemaOptions ): TUnion<[ T, TArray<T> ]> =>
    Type.Union( [ schema, Type.Array( schema ) ], options );

export const Nullable = <T extends TSchema>( schema: T, options?: SchemaOptions ): TOptional<TUnion<[ T, TNull ]>> =>
    Type.Optional( Type.Union( [ schema, Type.Null() ], options ) );

/** Makes the given keys optional on every member of a union of objects. */
export function UnionPartialSome<U extends TObject[], K extends AllKeys<Static<U[number]>>[]>(
    union: TUnion<U>,
    keys: readonly [ ...K ],
): TUnion<{ [I in keyof U]: TPartialSome<U[I], K> }> {
    return Type.Union( union.anyOf.map( ( schema ) => PartialSome( schema, keys as never ) ) ) as never;
}

/**
 * ISO date-time string on the wire, `Date` in your code: decoded for requests, encoded for responses.
 * (TypeBox 1.x replaced `Type.Transform` with `Type.Codec`.)
 */
export const IsoDate = ( options?: StringOptions ): TCodec<TString, Date> =>
    Type.Codec( Type.String( { format: 'date-time', ...options } ) )
        .Decode( ( value ) => new Date( value ) )
        .Encode( ( value ) => value.toISOString() );

export type { StaticDecode };
