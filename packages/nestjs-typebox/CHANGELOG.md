# Changelog

## 5.0.0-alpha.0

First release of the fork. Continues [`nestjs-typebox`](https://github.com/jayalfredprufrock/nestjs-typebox) 4.0.0.

### Breaking

- Requires NestJS 12.0.2+, `@nestjs/swagger` 12, and `typebox` 1.x (replaces `@sinclair/typebox` 0.34).
- Swagger integration rebuilt on NestJS 12's Standard Schema support; the `SchemaObjectFactory` patch is gone
  (Swagger 12 no longer exports it).
- Response validation failures are now 500 (`TypeboxResponseValidationException`) instead of 400.
- Validation `errors` are now `{ path, message, keyword }` instead of TypeBox `ValueError` objects.
- `configureNestJsTypebox()` is a no-op; `setFormats` isn't needed (formats are built into TypeBox 1.x).
- `$id` / `Type.Ref` references aren't supported yet.

### Added

- `typebox( schema, options )`: a TypeBox schema as a Standard Schema, for `@Body( { schema } )`, `@Query( { schema } )`,
  `@Param( name, { schema } )` and Swagger.
- `TypeboxValidationPipe`: global pipe for those schemas.
- `@TypeboxResponse( schema, options )`: documents and enforces a response (encode codecs, strip unknown
  properties, 500 on mismatch).
- `typeboxExceptionFactory` for Nest's `StandardSchemaValidationPipe`.
- Clearer errors: missing properties and unknown properties reported per property, union errors reported once,
  literal unions list their allowed values.
- Test suite (unit + NestJS 12 end-to-end, including the OpenAPI document).

### Fixed

- `@HttpEndpoint( { responseCode, validate: { response } } )` now documents the response under `responseCode`
  (v4 always used 200).
