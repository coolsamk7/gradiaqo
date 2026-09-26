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
| `/app` | Placeholder for the dashboard, logged-in users only (others go to `/login` and come back) |
| anything else | Not found |

## Talking to the API

- `src/api/client.ts` calls the API at `VITE_API_URL` (default http://localhost:3000; copy `.env.example` to `.env`
  to change it), always with cookies so the refresh token reaches `/auth/*`. Errors come back as `ApiError` (status,
  message, field errors, `Retry-After`) or `NetworkError` (API unreachable).
- Request/response types come from `@studylog/schemas`, the same contract the API validates against.
- `src/auth`: `AuthProvider` keeps the session. The access token lives in memory only (never localStorage); on
  startup the refresh cookie restores the session, so reloading doesn't log you out. `useAuth()` gives the state plus
  `logIn` / `logOut`, and `<RequireAuth>` protects pages.
- The API must allow this origin: http://localhost:5173 is in its default `CORS_ORIGINS`.

## Tests

`src/test/api.ts` fakes the API (answers `fetch` by `METHOD /path` and records calls) and `src/test/render.tsx`
renders the whole app at a URL, so tests go through the real routes and auth.
- Same code style, 100% coverage rule and mutation testing as the rest of the monorepo (see the root README).
