# @studylog/web

The StudyLog web app: React 19 + Vite + TypeScript + React Router. Pages are added one by one.

```sh
yarn workspace @studylog/web dev     # http://localhost:5173 (also started by `yarn dev` at the root)
yarn workspace @studylog/web build   # type-check, then build to dist/
yarn workspace @studylog/web test    # unit tests (Vitest + Testing Library, jsdom)
```

## Pages

| Path | Page |
|---|---|
| `/` | Homepage (`src/pages/home`) |
| `/login` | Log in (`src/pages/login`); logged-in users go straight to `/app` |
| `/signup` | Create an account (`src/pages/signup`), then straight into `/app`; logged-in users go straight there too |
| `/app` | Dashboard (`src/pages/dashboard`), logged-in users only (others go to `/login` and come back): study time today, this week and in total, streak, items completed, the last 30 days as a chart, learning paths with progress, and recent sessions |
| anything else | Not found |

## Talking to the API

- `src/api/client.ts` calls the API at `VITE_API_URL` (default http://localhost:3000; copy `.env.example` to `.env`
  to change it), always with cookies so the refresh token reaches `/auth/*`. Errors come back as `ApiError` (status,
  message, field errors, `Retry-After`) or `NetworkError` (API unreachable).
- Request/response types come from `@studylog/schemas`, the same contract the API validates against.
- `src/auth`: `AuthProvider` keeps the session. The access token lives in memory only (never localStorage); on
  startup the refresh cookie restores the session, so reloading doesn't log you out. `useAuth()` gives the state plus
  `logIn` / `signUp` / `logOut`, and `<RequireAuth>` protects pages.
- Call the API as the logged-in user with `useAuth().request( path, options )`, never `apiRequest` with a token by
  hand. When the access token expires (15 minutes), it renews it with the refresh cookie and retries once; concurrent
  requests share one renewal (each refresh rotates the cookie). If the session is over (logged out elsewhere,
  revoked), it logs out and `<RequireAuth>` sends the user to the login page, which says the session ended and
  brings them back after logging in. Only 401s with `WWW-Authenticate: Bearer` trigger a renewal, so a wrong
  password stays a normal error.
- Login and signup share `src/components/AuthLayout.tsx` and `src/forms` (fields, password input, error messages).
  Each page checks what it can before calling the API (same limits as the schemas), shows the API's errors on
  their fields, and focuses the first problem. Links between them keep the router state (`from`: where to go next).
- The API must allow this origin: http://localhost:5173 is in its default `CORS_ORIGINS`.

## Tests

`src/test/api.ts` fakes the API (answers `fetch` by `METHOD /path` and records calls, query strings included) and
`src/test/render.tsx` renders the whole app at a URL, so tests go through the real routes and auth. Tests run in UTC
(`vitest.config.ts`), so dates and times read the same on every machine.
- Same code style, 100% coverage rule and mutation testing as the rest of the monorepo (see the root README).
