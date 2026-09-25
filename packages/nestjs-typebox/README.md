# @gradiaqo/nestjs-typebox

[TypeBox](https://github.com/sinclairzx81/typebox) validation and OpenAPI docs for **NestJS 12**, as an
alternative to `class-validator` / `class-transformer`.

> **Fork of [`nestjs-typebox`](https://github.com/jayalfredprufrock/nestjs-typebox) by Andrew Smiley** (MIT).
> v4 of the original supports NestJS 9–11 and `@sinclair/typebox` 0.34. This fork continues it as **v5** for
> NestJS 12 and TypeBox 1.x, and keeps the v4 `@Validate()` / `@HttpEndpoint()` API so existing code can upgrade.

## Why v5 works differently

NestJS 12 added built-in [Standard Schema](https://standardschema.dev) support: `@Body( { schema } )`,
`@Query( { schema } )`, `@Param( name, { schema } )`, and Swagger reading those schemas. v4 patched private
`@nestjs/swagger` internals to get similar results; Swagger 12 no longer exposes them, so v4 can't work there.

v5 wraps TypeBox schemas as Standard Schemas and uses those official hooks instead. No monkey-patching, so
NestJS and Swagger upgrades are much less likely to break it.

## Requirements

- NestJS 12.0.2+ (`@nestjs/common`, `@nestjs/core`), `@nestjs/swagger` 12
- `typebox` 1.3+ (the new package name; not `@sinclair/typebox`)
- Node.js 22.12+

```sh
yarn add @gradiaqo/nestjs-typebox typebox
```

## Quick start

```ts
// main.ts
app.useGlobalPipes( new TypeboxValidationPipe() );
```

```ts
import { Body, Controller, Param, Post, Get } from '@nestjs/common';
import { IsoDate, typebox, TypeboxResponse } from '@gradiaqo/nestjs-typebox';
import Type, { type Static } from 'typebox';

const CreateCat = typebox(
    Type.Object( { name: Type.String( { minLength: 1 } ), age: Type.Integer( { minimum: 0 } ) }, { additionalProperties: false } ),
    { name: 'CreateCat' }, // OpenAPI component name
);
const Cat = Type.Object( { id: Type.String(), name: Type.String(), bornAt: IsoDate() } );
const CatId = typebox( Type.String( { format: 'uuid' } ) );

@Controller( 'cats' )
export class CatsController {
    @Post()
    @TypeboxResponse( Cat, { status: 201, name: 'Cat' } )
    create( @Body( { schema: CreateCat } ) body: Static<typeof CreateCat.schema> ) {
        return this.cats.create( body ); // may return an entity with extra fields: they're stripped
    }

    @Get( ':id' )
    @TypeboxResponse( Cat, { name: 'Cat' } )
    findOne( @Param( 'id', { schema: CatId } ) id: string ) {
        return this.cats.findOne( id );
    }
}
```

What you get:

- **Request validation** with TypeBox's compiled (JIT) validators; defaults applied; codecs decoded.
- **Response shaping**: `@TypeboxResponse()` encodes codecs (`Date` → ISO string), strips properties that aren't
  in the schema (e.g. a password hash on an entity), and returns **500** if the handler breaks its contract.
- **OpenAPI**: request bodies, params, queries and responses documented, named schemas as components.

### Options

```ts
typebox( schema, {
    name: 'CreateCat',     // OpenAPI component name; unnamed schemas are inlined
    stripUnknown: false,   // remove unknown properties before checking (responses default to true)
    coerce: false,         // '5' → 5, 'true' → true: use for query strings and path params
    direction: 'request',  // 'response' encodes instead of decodes
} );
```

To reject unknown properties instead of stripping them, use `additionalProperties: false` on the object.

### Errors

Invalid requests get a **400**:

```json
{
  "statusCode": 400,
  "message": "Validation failed (body)",
  "errors": [
    { "path": "/age", "message": "is required", "keyword": "required" },
    { "path": "/name", "message": "must not have fewer than 1 characters", "keyword": "minLength" },
    { "path": "/isAdmin", "message": "is not allowed", "keyword": "additionalProperties" }
  ]
}
```

- Set `errorMessage` on any schema to replace its default message: `Type.String( { format: 'email', errorMessage: 'Enter a valid email' } )`.
- Union failures report once (`must be one of 'S', 'M'` for literal unions), not once per branch.

Using Nest's built-in `StandardSchemaValidationPipe` instead? Pass `exceptionFactory: typeboxExceptionFactory`
for the same error shape.

## v4-compatible API

`@Validate()` and `@HttpEndpoint()` work as in v4:

```ts
@HttpEndpoint( {
    method: 'POST',
    path: ':ownerId/cats',
    responseCode: 201,
    validate: {
        request: [
            { type: 'param', name: 'ownerId', schema: Type.Integer() },          // coerced from the URL
            { type: 'query', name: 'dryRun', schema: Type.Boolean(), required: false },
            { type: 'body', schema: CreateCatSchema },
        ],
        response: CatSchema,
    },
} )
create( ownerId: number, dryRun: boolean | undefined, body: Static<typeof CreateCatSchema> ) {}
```

## Utilities

Ported to TypeBox 1.x: `LiteralUnion`, `PartialSome`, `UnionPartialSome`, `DistOmit`, `DistPick`, `MaybeArray`,
`Nullable`, `IsoDate`.

## Migrating from v4

| v4 | v5 |
|---|---|
| `@sinclair/typebox` 0.34 | `typebox` 1.x: `import Type from 'typebox'` |
| `Type.Transform( … ).Decode( … ).Encode( … )` | `Type.Codec( … ).Decode( … ).Encode( … )` |
| `Type.Composite( [ … ] )` | `Type.Evaluate( Type.Intersect( [ … ] ) )` |
| `configureNestJsTypebox( { patchSwagger, setFormats } )` | Not needed (kept as a no-op). Formats are built into TypeBox 1.x. |
| Response validation failure → 400 | → **500** (`TypeboxResponseValidationException`): it's a server bug, not bad input |
| `errors`: TypeBox `ValueError` objects | `errors`: `{ path, message, keyword }` |
| `HttpEndpoint( { responseCode: 201, validate: { response } } )` documented the response as 200 | Documented under the endpoint's `responseCode` |
| `$id` / `Type.Ref` references | Not supported yet: inline the schema, or name it with `typebox( schema, { name } )` |

Don't combine `@Validate()` / `@HttpEndpoint()` with Nest's `StandardSchemaValidationPipe` as a global pipe: it
would validate those parameters a second time. The global `TypeboxValidationPipe` knows to skip them.

## License

MIT. Original work © 2022 Andrew Smiley; changes © 2026 Sameer Khandke. See [LICENSE](./LICENSE).
