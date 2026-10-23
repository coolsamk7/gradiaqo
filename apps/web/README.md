# @studylog/web

The StudyLog web app: React 19 + Vite + TypeScript + React Router, styled to the Figma file with CSS modules.

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
| `/forgot-password`, `/reset-password` | Reset a forgotten password with a 6-digit code emailed to you (`src/pages/password-reset`) |
| `/verify-email` | Enter the code emailed after signup (`src/pages/verify-email`); until then every page shows a reminder. "Use a different email" opens the change-email dialog in Settings |
| `/app` | Dashboard (`src/pages/dashboard`), logged-in users only (others go to `/login` and come back): study time today, this week and in total, streak, items completed, the last 30 days as a chart, learning paths with progress, and recent sessions |
| `/app/sessions` | Study sessions (`src/pages/sessions`): history by day with daily totals, a page at a time; log a session (learning path → topic → optional item, date, start, minutes, notes), edit its time, minutes and notes, or delete it. `?log` opens the form (the dashboard's "Log session" button); `path`, `topic` and `item` choose what it's about |
| `/app/catalog/:pathId` | Path preview (`src/pages/path-preview`): what's in a path and who made it, before enrolling; enroll in all of it or choose the modules and topics to follow. Another user's public path can be reported to the admins from its About card |
| `/app/paths/:enrollmentId` | A learning path you follow (`src/pages/path`), opened from the dashboard: modules, topics (the first unfinished one open) and items in your order, with progress at every level. Set each item's status, open it (problems, articles, videos…) or read it here (notes, exercises with a hidden answer), and "Log time" on it (the session form opens with the path, topic and item chosen) |
| `/app/paths/:enrollmentId/settings` | Path settings (`src/pages/path-settings`): pause, resume, complete or leave a path, change the parts you follow, and put its modules and topics in your own order |
| `/app/catalog` | Browse paths (`src/pages/catalog`): every path you can see, filtered by source (All, Official, Your organizations, Community, Yours) and searched by title (both kept in the URL as `?source=` and `?q=`). Each card shows where the path comes from, whether you're enrolled, its modules, items and estimated time, and Continue (your path page) or View path |
| `/app/my-paths` | My paths (`src/pages/my-paths`): the paths you build, in your workspace or an organization you own or run (tabs, kept in the URL as `?org=`), and New path |
| `/app/my-paths/:organizationId/:pathId` | Path builder: add, rename, move and delete modules and topics; for a topic, link items from the catalog, create your own (problem, article, video, book, course, note, exercise), mark them optional, move and remove them; make a workspace path public or private; delete the path. Every change is saved right away |
| `/app/analytics` | Analytics (`src/pages/analytics`): for a period and path (kept in the URL), study time per week and by path, items by status and difficulty, and the topics that need focus |
| `/app/interview-ready` | Interview ready (`src/pages/readiness`): set an interview goal (date and paths), then see how ready you are, by category, and what to do next |
| `/app/settings` | Settings (`src/pages/settings`): your name, email (checked with a code sent to the new address), password, and deleting your account |
| `/app/organizations` | Organizations (`src/pages/organizations`): invitations waiting for you (accept or decline), then a card per organization with its members and paths; New organization |
| `/app/organizations/:organizationId` | One organization: members (search; owners and admins change roles and remove people; anyone can leave), invitations (owners and admins invite by email and revoke) and its published paths, as tabs (`?tab=`). Owners and admins rename it; owners delete it after typing its name |
| `/app/admin` | In the sidebar for superadmins, designed in Figma, not built yet: a "Coming soon" page (`src/pages/coming-soon`; remove a section from `upcoming.ts` when its page exists) |
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
- The look follows the Figma file "StudyLog – App Design" (https://www.figma.com/design/OtHkuUtj5AK1MYZYgMEJRH).
  `src/index.css` holds its tokens under the same CSS names as the Figma variables (colors with dark values, spacing,
  radius, shadows, fonts: Inter and JetBrains Mono); components use only these. Icons: `src/components/Icon.tsx`.
- Pages of the logged-in app share `src/components/AppLayout.tsx` (dark sidebar with navigation and log out; a top bar
  with a menu below 900px) and `ProgressBar.tsx`, `src/styles/shared.module.css` (buttons: primary, accent, secondary,
  ghost, danger, small), `src/styles/app.module.css` (page headers, cards, badges, loading and error states, session
  rows) and `src/format` (minutes, dates, session titles).
- Login and signup share `src/components/AuthLayout.tsx` and `src/forms` (fields, password input, error messages).
  Each page checks what it can before calling the API (same limits as the schemas), shows the API's errors on
  their fields, and focuses the first problem. Links between them keep the router state (`from`: where to go next).
- The API must allow this origin: http://localhost:5173 is in its default `CORS_ORIGINS`.

## Tests

`src/test/api.ts` fakes the API (answers `fetch` by `METHOD /path` and records calls, query strings included),
`src/test/fixtures.ts` builds typed API answers (enrollments, path trees, sessions), and `src/test/render.tsx` renders
the whole app at a URL, so tests go through the real routes and auth. Tests run in UTC (`vitest.config.ts`), so dates
and times read the same on every machine.
- Same code style, 100% coverage rule and mutation testing as the rest of the monorepo (see the root README).
