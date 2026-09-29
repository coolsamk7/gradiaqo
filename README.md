# StudyLog

Study time tracker. Turborepo monorepo using Yarn workspaces.

- `apps/api`: NestJS backend
- `apps/web`: React web app (Vite), at http://localhost:5173; empty for now (see `apps/web/README.md`)
- `apps/cli`: command-line tools (database migrations), built with nest-commander (`@studylog/cli`)
- `packages/common`: shared configs for every app/package: ESLint rules (`@studylog/common/eslint/*`, with `react` for the web app), tsconfigs (`@studylog/common/tsconfig/*`), coverage and mutation testing settings
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
yarn cli db:seed           # optional: dummy users, catalog and study history (see below)
yarn dev                   # start the API and the web app
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

## Dummy data

```sh
yarn cli db:seed           # add the dummy data (refuses if the dummy users already exist)
yarn cli db:seed --reset   # delete ALL data first, then add it (the schema and migrations are kept)
```

Every dummy user's password is `password123`: `admin@example.com` (superadmin), `alice@example.com`,
`bob@example.com`, `carol@example.com` and `dave@example.com`. Each has a personal workspace, and Alice, Bob and
Carol share the "Acme Study Group" organization (owner, admin, member), which has two pending invitations. The
catalog has global paths (Data Structures & Algorithms, System Design Fundamentals, and a draft Graph Algorithms),
the team's own path and a public path in Alice's workspace. Their modules, topics and items (problems, articles,
videos, books, courses, notes, exercises) are linked across paths. Alice, Bob and Carol have enrollments,
progress and about a month of study sessions, and Alice's public path has two reports (one open, one dismissed).

- The data is written in `apps/cli/src/seed/seed-content.ts`; `seed-data.ts` turns it into rows. Dates are
  relative to today, and the study activity is generated from a fixed seed, so every run looks the same.
- Everything is inserted in one transaction: a failure leaves the database as it was.
- It never runs when `NODE_ENV=production`.

## Tests

```sh
yarn test                            # unit tests in every app and package (no database needed)
yarn workspace @studylog/api test:e2e # end-to-end tests against the database from yarn db:up
```

- Unit tests sit next to the code (`*.spec.ts`, Vitest). Services are tested against an in-memory stand-in for
  TypeORM (`apps/api/test/unit/fake-data-source.ts`): each test sets up only the database answers its rule depends
  on and checks the calls it expects. Permission tests use the real CASL rules.

### Coverage

```sh
yarn test:cov            # every app and package, then one combined table
open coverage/index.html # the combined report; click a package for its line-by-line report
```

- Each app/package writes `coverage/` (HTML, `lcov.info` for CI and editors, `coverage-summary.json`);
  `scripts/coverage-summary.mjs` combines them into the table and `coverage/index.html` at the root.
- Settings are shared in `@studylog/common/vitest/coverage`. Left out: `main.ts` and `*.module.ts` (wiring), and in
  `packages/database` the entities (declarations) and generated migrations.
- **Coverage must stay at 100%** (lines, branches, functions, statements) in every app and package: the run fails
  otherwise, so new code comes with its tests. No `/* v8 ignore */` comments are used.
- One package only: `yarn workspace @studylog/api test:cov`.

### Mutation testing

```sh
yarn test:mutation                            # every app and package, one at a time, then one table (slow)
yarn workspace @studylog/logger test:mutation # one package
```

Coverage says a line ran; mutation testing checks that a test would notice if it were wrong. Stryker makes small
changes to the code ("mutants": `>` to `>=`, `true` to `false`, a removed call, ...) and runs the tests against each.
A mutant the tests catch is **killed**; one they miss **survives** and points at behavior no test checks. The
**mutation score** is the share killed.

- Settings are shared in `@studylog/common/stryker/config`; it mutates the same files coverage measures.
- Reports: `<package>/reports/mutation/mutation.html` shows each surviving mutant in the code.
  `scripts/mutation-summary.mjs` prints the combined table.
- Runs are incremental (`reports/stryker-incremental.json`): later runs only retest mutants in changed code.
- Mutants that don't compile aren't type-checked out, so a few survivors can be impossible code.
- No minimum score yet; one will be set once the current survivors are handled.

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

Settings are checked at startup (`apps/api/src/config/env.ts`): a missing or invalid value stops the API with a
list of every problem. `JWT_SECRET` must be at least 32 characters, and `NODE_ENV=production` requires
`COOKIE_SECURE=true`.

### Protection

- **Rate limits** per client IP (`apps/api/src/rate-limits.ts`): 300 requests/minute by default; tighter on login
  (10/min), signup (10/hour), refresh (60/min), change password and delete account (5 per 15 min), invitations
  (30/hour) and reports (10/hour). Over the limit: `429` with `Retry-After`. Counters are in memory, so each API
  instance counts separately; use a shared store (e.g. Redis) before running several.
- Behind a load balancer or CDN, set `TRUST_PROXY` to the number of proxies so limits and logs use the real client IP.
- **Security headers** via helmet (CSP, HSTS, no sniffing, no framing).
- **`GET /health`** returns `{ status, database }`: 200 when the database answers, 503 when it doesn't. Not rate
  limited or logged; use it for load balancer and uptime checks.

### CORS (browser apps)

Set `CORS_ORIGINS` in `apps/api/.env` to the exact origins of your web apps, comma-separated, e.g.
`http://localhost:5173,https://app.example.com`. Empty means no cross-origin access. No `*` or trailing slash: the
API allows credentials (the refresh cookie), so every site must be named, and an invalid entry stops the API at
startup. The frontend can read the `X-Request-Id` response header.

The refresh cookie is `SameSite=Strict`, so it's only sent when the web app is on the **same site** as the API:
`localhost` on any port, or subdomains of one domain (`app.example.com` + `api.example.com`). Calls from a different
domain work for access-token requests, but `/auth/refresh` won't get the cookie.

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

- Access token: JWT, 15 minutes. A 401 caused by the access token (missing, expired or invalid) carries
  `WWW-Authenticate: Bearer` (RFC 6750; `error="invalid_token"` when one was sent): renew it with `/auth/refresh` and
  retry. Other 401s, like a wrong password, don't have that header.
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

## Roadmap

What's still open, so it isn't forgotten. Tick items off (or remove them) as they're done. New code must keep unit
test coverage at 100% (see [Tests](#tests)).

### Backend features

- [ ] **OTP and email** (needs an email provider, e.g. Resend, SendGrid, Amazon SES, or SMTP for development)
  - [ ] Email verification at signup
  - [ ] Password reset
  - [ ] Changing your email (verify the new address first)
  - [ ] Send invitation emails (today invited people only see them in `GET /me/invitations`)
- [ ] **Moderation:** let a superadmin un-hide a path hidden by mistake (clear `publicBlockedAt`)
- [ ] **Pagination** for `GET /catalog/paths` and `GET /me/enrollments` (both return everything today)
- [ ] **Study reminders / notifications**, e.g. "you haven't studied today, keep your streak"
- [ ] **Data export:** a user downloads their progress and study sessions
- [ ] **Performance:** `GET /me/enrollments` builds each path's tree one by one to count progress; batch it once users
  have many enrollments
- [ ] **Rate limits in a shared store** (e.g. Redis) before running more than one API instance; counters are in memory

### Testing

- [ ] **Raise mutation scores** and set a minimum (`thresholds.break` in `@studylog/common/stryker/config`). Last run:
  total 71.6%; api 81.4%, cli 91.9%, casl 86.8%, nestjs-typebox 84.9%, logger 83.1%, database 58.3%, schemas 10.9%,
  nestjs 2.8%
  - [ ] Contract snapshot of every request/response schema (most survivors in `schemas` and `nestjs`)
  - [ ] Test that every `*Request` schema rejects unknown fields; date formats and numeric limits
- [ ] **End-to-end tests** against a real database (permissions, visibility, the SQL the unit tests fake)
- [ ] **Property-based tests** (fast-check) for pure logic: enrollment rules and ordering, streaks and dates, slugs
- [ ] **Type-check mutants** (`@stryker-mutator/typescript-checker`) for more accurate mutation scores

### Tooling and deployment

- [ ] **CI (GitHub Actions)** on every push and pull request: build, lint, `yarn test:cov`,
  `yarn cli migration:generate x --check`, and mutation testing on changed code (incremental)
- [ ] **Branch protection** on `master`: pull requests only, CI must pass, no force pushes
  (needs GitHub Pro, or a public repository)
- [ ] **Pre-commit hooks** (husky + lint-staged): lint and related tests on committed files
- [ ] **Dockerfile and deployment**, with `migration:run` as a release step; check production settings
  (`NODE_ENV=production`, `COOKIE_SECURE=true`, `SWAGGER_ENABLED=false`, `LOG_PRETTY=false`, `TRUST_PROXY`)
- [ ] **Dependency updates** (Dependabot or Renovate) and `yarn npm audit` in CI

### Operations

- [ ] **Error tracking** (e.g. Sentry)
- [ ] **Metrics:** request counts, latency, database timing
- [ ] **Graceful shutdown:** close database connections cleanly on deploy

### Documentation

- [ ] Replace the NestJS starter READMEs in `apps/api` and `apps/cli`
- [ ] Architecture overview (catalog, enrollments, permissions)

### Frontend

- [x] Empty web app (`apps/web`: React + Vite), with the repo's lint, tests and coverage
- [x] Homepage
- [x] Login page, API client and session handling (restored from the refresh cookie on reload)
- [x] Signup page
- [x] Renew the access token automatically when it expires (15 minutes) during use: retry once after
  `POST /auth/refresh` on a 401
- [ ] Dashboard at `/app`, then catalog, enrollments, progress, study sessions and stats pages
- [ ] Mobile app
