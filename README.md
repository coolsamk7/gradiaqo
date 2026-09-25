# StudyLog

Study time tracker. Turborepo monorepo using Yarn workspaces.

- `apps/api`: NestJS backend
- `apps/cli`: command-line tools (database migrations), built with nest-commander (`@studylog/cli`)
- `packages/common`: shared configs for every app/package: ESLint rules (`@studylog/common/eslint/*`) and tsconfigs (`@studylog/common/tsconfig/*`)
- `packages/schemas`: the API contract as TypeBox schemas + types + role enums, no framework deps (`@studylog/schemas`); shareable with web/mobile
- `packages/nestjs`: those schemas wired into NestJS: request bodies and documented responses (`@studylog/nestjs`)
- `packages/nestjs-typebox`: `@gradiaqo/nestjs-typebox`, our NestJS 12 fork of nestjs-typebox (see its README)
- `packages/casl`: authorization: CASL rules per role + NestJS guards/decorators (`@studylog/casl`)
- `packages/logger`: pino logging for NestJS apps (`@studylog/logger`)
- `packages/database`: TypeORM entities, migrations and the shared connection config (`createDataSourceOptions`)
- `docker-compose.yml`: local PostgreSQL

```sh
yarn install
yarn db:up                 # start Postgres on localhost:5432
yarn cli migration:run     # create/update the tables
yarn dev                   # start the API
yarn db:down               # stop Postgres (data is kept)
```

Database URL: `postgresql://studylog:studylog@localhost:5432/studylog`

## Database migrations

The schema is changed only by migrations, never `synchronize`. Migrations live in `packages/database/src/migrations`
and are run by the CLI (`apps/cli`, reads `DATABASE_URL` from `apps/cli/.env`: `cp apps/cli/.env.example apps/cli/.env`).
`yarn cli <command>` builds the CLI and the database package first, so new migrations are picked up.

| Command | What it does |
|---|---|
| `yarn cli migration:generate <name>` | Write a migration from the difference between the entities and the database |
| `yarn cli migration:generate <name> --dry-run` | Print it instead of writing it |
| `yarn cli migration:generate <name> --check` | Exit with code 1 if the entities have unmigrated changes (for CI) |
| `yarn cli migration:create <name>` | Create an empty migration to write by hand |
| `yarn cli migration:run` | Apply pending migrations, each in its own transaction |
| `yarn cli migration:run --fake` | Mark pending migrations as applied without running them (database already has the schema) |
| `yarn cli migration:revert` | Undo the most recently applied migration |
| `yarn cli migration:show` | List migrations and whether each is applied |
| `yarn cli --help` | All commands |

Changing an entity:

1. Edit the entity in `packages/database/src/entities`.
2. `yarn cli migration:generate add-study-goals` (names: letters, numbers, dashes).
3. Review the generated file (it is lint-clean as written), then `yarn cli migration:run`.
4. Commit the entity change and the migration together.

A database that was created earlier with `synchronize` already has the tables: run `yarn cli migration:run --fake`
once so the `init` migration is recorded instead of failing.

## Code style

ESLint handles both code quality and formatting (no Prettier). Rules live in `packages/common/eslint`; each app/package has a 3-line `eslint.config.mjs` that uses them:

```js
import { nodeConfig } from '@studylog/common/eslint/node';

export default nodeConfig( { tsconfigRootDir: import.meta.dirname } );
```

- `yarn lint`: report problems
- `yarn lint:fix` / `yarn format`: auto-fix, including formatting and import order
- Style: 4-space indent, single quotes, semicolons, spaces inside brackets `foo( a, b )`, `[ 1, 2 ]`, `{ a: 1 }`, max line length 120
- Editor: install the ESLint extension and enable "fix on save"; turn off Prettier for this repo

## API setup

```sh
cp apps/api/.env.example apps/api/.env   # then set JWT_SECRET: openssl rand -base64 48
```

## Build

The API builds with the **SWC** builder (`nest-cli.json`), with type checking on. Packages build with `tsc`.
Tsconfigs extend `@studylog/common/tsconfig/nestjs.json`.

## Organizations and roles

Every user gets a **personal workspace** at signup (they are its `owner`). Later they can join or create more organizations.

- **Platform role** (on `users.platform_role`): `application_user` (default) or `superadmin`. Never settable from signup.
- **Organization role** (on `memberships.role`): `owner`, `admin`, `member`.
- Permissions are CASL rules in `packages/casl/src/ability.ts` (tested in `ability.spec.ts`).
- Org routes use `@OrganizationAuth()` + `@CheckAbilities( [ action, subject ] )`. The org comes from the
  `:organizationId` route param or the `X-Organization-Id` header. Non-members get 404.
- Route checks answer "can this user ever do X to a Y?"; also check the actual record in the handler/service:
  `ability.can( 'update', organization )`.
- Make someone superadmin (local): `update users set platform_role = 'superadmin' where email = '...'`, then log in again.

## Logging

[pino](https://getpino.io) via `nestjs-pino`, packaged as `@studylog/logger`. An app only needs:

```ts
imports: [ ConfigModule.forRoot( { isGlobal: true } ), LoggerModule.forRoot( { service: 'studylog-api' } ) ]
// main.ts
const app = await NestFactory.create( AppModule, { bufferLogs: true } );
app.useLogger( app.get( Logger ) ); // Logger from '@studylog/logger'
```


- One log line per request: method, URL, status, duration, request id, and `userId` / `organizationId` when known.
  5xx → `error`, 4xx → `warn`, the rest → `info`. `/docs` isn't logged.
- Every response has an `X-Request-Id` header. Send your own `X-Request-Id` to trace a request across services.
- Authorization headers, cookies, passwords and tokens are always redacted.
- `.env`: `LOG_LEVEL` (`debug`, `info`, ...) and `LOG_PRETTY` (`true` locally for readable colored logs,
  `false` in production for JSON).
- In code, keep using Nest's logger: `private readonly logger = new Logger( MyService.name );`. It goes through pino
  and includes the request id automatically.

## Adding endpoints

Validation is TypeBox (via `@gradiaqo/nestjs-typebox`), not class-validator.

1. Define the request/response shape in `packages/schemas` (`Type.Object( { ... }, { additionalProperties: false } )`).
   Use `Email()`, `TrimmedText( max )`, `IsoDate()`, `Uuid()` from there for normalized inputs and dates.
2. Wrap it in `packages/nestjs`: `export const CreateThingBody = typebox( CreateThingRequest, { name: 'CreateThingRequest' } )`
   and add the response to `Responses`.
3. In the controller:
   ```ts
   @Post()
   @TypeboxResponse( Responses.Thing, { status: 201 } )
   create( @Body( { schema: CreateThingBody } ) body: CreateThingRequest ) {}
   ```
   `@TypeboxResponse` documents the response and enforces it: dates become ISO strings and unknown fields (e.g. a
   password hash) are stripped.

Validation errors (400) look like:
`{ "message": "Validation failed (body)", "errors": [ { "path": "/email", "message": "...", "keyword": "pattern" } ] }`

## API docs (Swagger)

With `SWAGGER_ENABLED=true` in `apps/api/.env`, open http://localhost:3000/docs (OpenAPI JSON at `/docs/json`).
Log in via `/auth/login`, click **Authorize**, and paste the `accessToken`.

## Auth endpoints

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/signup` | `email, firstName, lastName, password` | Returns `{ accessToken, user }`, sets refresh cookie |
| POST | `/auth/login` | `email, password` | Returns `{ accessToken, user }`, sets refresh cookie |
| POST | `/auth/refresh` | none (uses cookie) | Returns `{ accessToken }`, rotates refresh cookie |
| POST | `/auth/logout` | none (uses cookie) | Ends the session, clears cookie |
| GET | `/auth/me` | none | Needs `Authorization: Bearer <accessToken>` |
| PATCH | `/auth/me` | `firstName?, lastName?` | Update your name |
| POST | `/auth/change-password` | `currentPassword, newPassword` | Signs out your other devices |
| POST | `/auth/delete-account` | `password` | See "Accounts" below |

## Accounts

- Changing your password ends every other session (their refresh tokens stop working; access tokens expire within
  15 minutes); the device you changed it from stays signed in.
- Deleting your account deletes your personal workspace (your own paths and items), organizations where you're the only
  member, and your enrollments, progress and study sessions. It's refused while you're the only owner of an
  organization with other members: make someone else owner, or delete the organization, first.
- Not yet (they need email codes): password reset, email verification, changing your email.

## Organizations

Every user has a personal workspace; for studying together, create an organization (e.g. a study group).

| Method | Path | Body | Who |
|---|---|---|---|
| GET / POST | `/organizations` | POST: `name` | Your organizations / create one (you become owner) |
| GET / PATCH / DELETE | `/organizations/:organizationId` | PATCH: `name` | Members / owner or admin / owner |
| GET | `/organizations/:organizationId/members` | none | Any member |
| PATCH / DELETE | `/organizations/:organizationId/members/:userId` | PATCH: `role` | Owner or admin (see rules) |
| POST | `/organizations/:organizationId/leave` | none | Any member |
| GET / POST | `/organizations/:organizationId/invitations` | POST: `email, role?` | Owner or admin |
| DELETE | `/organizations/:organizationId/invitations/:invitationId` | none | Owner or admin (revoke) |
| GET | `/me/invitations` | none | Invitations sent to your email |
| POST | `/me/invitations/:invitationId/accept` · `/decline` | none | The invited user |

- **Invitations** go to an email, even one without an account yet; that person sees them in `/me/invitations` once
  logged in with that email. They're valid for 14 days; inviting again updates the role and restarts the 14 days.
  (Nothing is emailed yet.) An invitation gives `member` (default) or `admin`.
- **Roles:** owners can change anyone and make others owner; admins can manage members and admins but never owners.
- **Always an owner:** the last owner can't be demoted, removed or leave; make someone else owner first (or delete the
  organization).
- Personal workspaces can't be deleted, left, or have members added.

- Access token: JWT, 15 minutes.
- Refresh token: `httpOnly` cookie on `/auth`, rotated on every refresh. Expiry slides 180 days forward each time, so active users stay logged in.
- Reusing an already-rotated refresh token (outside a 30s grace window for concurrent tabs) revokes that session.

## Learning catalog

Study material in paths. There's one **global catalog**, managed by superadmins under `/admin/catalog`, and every
organization has **its own catalog** under `/organizations/:organizationId/catalog` (see "Your own learning paths"
below). Both use the same routes after that prefix:

```
Learning path   DSA · NestJS · Physics
 └─ Module      Arrays & Hashing
     └─ Topic   Two Pointers
         └─ Item   (linked) Two Sum II · "Two Pointers Explained" video · ...
```

- **Items are shared.** An item is stored once and linked to any number of topics (`topic_items`, with its own
  `position` and `isOptional` per topic), so it is edited in one place and progress on it will count everywhere.
- **Item types:** `problem`, `article`, `video`, `book`, `course`, `note`, `exercise`. Common fields are columns;
  type-specific ones go in `details` (jsonb), checked by the type's schema in `ItemDetailsSchemas`
  (`packages/schemas/src/catalog.ts`). Adding a type means adding a schema there, not a migration.
- **Status:** `draft` → `published` → `archived`. In the global catalog new content starts as a draft and only drafts
  can be deleted (a 409 says to archive instead), because published content may be in users' paths and history.
  Deleting a path/module/topic deletes everything under it except items, which stay in the catalog.
- **Order:** new children go at the end; reorder by sending every child id in the new order (`PUT .../order`).
- **Slugs** are generated from the title when omitted, are unique per parent (paths: per catalog), and don't change
  when the title does.
- `organization_id` is null for the global catalog, otherwise the organization that owns the path or item.

| Method | Path | Notes |
|---|---|---|
| GET / POST | `/admin/catalog/paths` | List in order / create |
| PUT | `/admin/catalog/paths/order` | `{ ids }` |
| GET / PATCH / DELETE | `/admin/catalog/paths/:pathId` | GET returns the whole tree |
| POST | `/admin/catalog/paths/:pathId/modules` | |
| PUT | `/admin/catalog/paths/:pathId/modules/order` | `{ ids }` |
| PATCH / DELETE | `/admin/catalog/modules/:moduleId` | |
| POST | `/admin/catalog/modules/:moduleId/topics` | |
| PUT | `/admin/catalog/modules/:moduleId/topics/order` | `{ ids }` |
| PATCH / DELETE | `/admin/catalog/topics/:topicId` | |
| GET | `/admin/catalog/topics/:topicId/items` | Items in order |
| PUT / DELETE | `/admin/catalog/topics/:topicId/items/:itemId` | Link (`{ isOptional? }`, safe to repeat) / unlink |
| PUT | `/admin/catalog/topics/:topicId/items/order` | `{ ids }` (item ids) |
| GET / POST | `/admin/catalog/items` | Filter: `type`, `status`, `tag`, `search`, `limit`, `offset` |
| GET / PATCH / DELETE | `/admin/catalog/items/:itemId` | The type can't change |

## Your own learning paths

Every user has a personal workspace (an organization they own), so every user has their own catalog:
`/organizations/<workspace id>/catalog/...`, with the same routes as the global catalog. Get the id from
`GET /organizations` (`isPersonal: true`).

- **Who can edit:** an organization's owners and admins; members can only view and enroll. Superadmins can edit any.
- **Visibility** (`visibility` on the path):
  - personal workspace: `private` by default (only you), or `public` (in everyone's catalog, anyone can enroll)
  - shared organization: always for its members only (`public` is rejected)
  - global catalog: always public
- **Where a path comes from:** `/catalog/paths` includes `organization` (name, whether it's a personal workspace)
  and `createdBy` (name only) for user-made paths, both null for official ones. Filter with
  `?source=official|mine|organizations|community` and `?search=`.
- **Reusing global material:** link any *published* global item into your own topics (find them with
  `GET /catalog/items?search=`). It isn't copied, so progress on it counts everywhere. You can't edit global items, and
  can only link your own organization's items.
- Your content is **published right away** and can be **deleted at any time** (no draft/archive rules). Creating a path
  in your personal workspace **enrolls you in it** automatically.
- **Reports:** anyone can report another user's public path (`POST /catalog/paths/:pathId/reports`, reason `spam`,
  `inappropriate`, `copyright` or `other`). Superadmins review them at `GET /admin/reports` and either `dismiss` or
  `hide_path` (`PATCH /admin/reports/:reportId`). Hiding makes the path private for good (`publicBlockedAt` is set;
  its owner keeps it) and closes all open reports on it.
- If a path becomes invisible to someone (made private, or they leave the organization), their enrollment stays but
  shows no content, and they can no longer track its items.

## Studying: enrollments, progress, sessions, stats

What a logged-in user does with the catalog. Everything under `/me` only ever touches the caller's own data
(someone else's ids give 404). Catalog content is referenced, never copied, so admin edits reach everyone.

- **Browsing** shows published paths you can see: the global catalog, your organizations' paths (including your own)
  and paths others made public. A path, and every module, topic and item in it, must be `published`.
- **Enrollment** = a user following a path. With no rules it covers the whole path, including content added later.
- **Rules** narrow it down: `include` / `exclude` a `module`, `topic` or `item`, covering everything under it. With no
  include rules the whole path is selected; with some, only what they cover. For each item the most specific rule
  wins (item → topic → module), so "Arrays, but not Hashing" is `include module` + `exclude topic`. "Skip this" is an
  `exclude item` rule.
- **Custom order** per parent (a path's modules, a module's topics, a topic's items). Children not listed, e.g. added
  by the admin later, follow in the admin's order. Users can't move things between parents.
- **Progress** is per item (`not_started` · `in_progress` · `done` · `revise`), so an item done once shows as done in
  every topic and path. Finishing the last required item of an active enrollment marks it `completed` (it's never
  moved back automatically). Counts at topic/module/path level are calculated: required (non-optional) items that are
  `done` or `revise`, each item once. Unenrolling keeps progress and sessions.
- **Study sessions** log minutes against a published topic and/or item (the item must be in the topic if both), with
  optional notes. `startedAt` can't be in the future (5 minutes of clock skew allowed).
- **Stats** count days in the time zone passed as `?timeZone=Asia/Kolkata` (default UTC); weeks start on Monday; the
  current streak survives until the end of a day without study.

| Method | Path | Notes |
|---|---|---|
| GET | `/catalog/paths` | Paths you can see, with your `enrollmentId` in each |
| GET | `/catalog/paths/:pathId` | A path you can see, with its published content |
| GET | `/catalog/items` | Search published global items (to link into your own paths) |
| GET / POST | `/me/enrollments` | Your paths with progress / enroll (`{ learningPathId, rules? }`) |
| PUT | `/me/enrollments/order` | Dashboard order: `{ ids }` |
| GET / PATCH / DELETE | `/me/enrollments/:id` | Your tree with progress / `{ status }` / unenroll |
| PUT | `/me/enrollments/:id/rules` | Replace rules: `{ rules: [ { scope, scopeId, mode } ] }` |
| PUT / DELETE | `/me/enrollments/:id/orders/:parentType/:parentId` | Your order `{ ids }` / back to the admin's |
| GET | `/me/progress` | Items you have progress on (`?status=`) |
| GET / PUT | `/me/progress/:itemId` | `{ status }` |
| GET / POST | `/me/study-sessions` | Filter: `from`, `to`, `topicId`, `itemId`, `limit`, `offset` |
| PATCH / DELETE | `/me/study-sessions/:id` | |
| GET | `/me/stats` | Today, this week, total, streaks, items completed, last 30 days |
