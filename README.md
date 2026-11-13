# ton-observer dashboard

A Next.js dashboard for the [ton-observer](../ton-observer) indexer. People sign in with their
ton-observer account, see the projects they belong to and act according to their role there:

- **Projects** (`/projects/<id>/…`): dashboard, addresses, transactions, members and settings.
  Owners manage members and generate the project's API key; owners and editors register and unlink
  addresses; viewers read.
- **Admin** (`/admin`, admins only): every project, new projects (with their first owner) and
  admin users. Admins can open any project read-only, add owners and resend invites.
- **Account** (`/account`): profile, password and sign out.

## Sign-in model

The session is ton-observer's own `__Host-session` cookie. Sign-in is **Google** (`/auth/google`)
or **email + password** (`POST /auth/login`); there is no key sign-in any more. Accounts are made
by invitation: an admin creates a project for an owner's email, owners add members by email, and
admins add other admins.

The browser only talks to this dashboard's origin. Two route handlers pass requests on to
`OBSERVER_API_URL` unchanged (cookies, `Origin`, the reply's `Set-Cookie` and redirects):

- `/auth/*` → `{API}/auth/*` (sign-in, Google, sign out, `me`, password)
- `/api/{graphql,users,projects,projects/…}` → `{API}/…`; any other `/api` path is a JSON 404.
  `/api/health` maps to `{API}/health/ready`.

The dashboard keeps no session or secret of its own. ton-observer checks the session and, on writes,
that `Origin` equals its `DASHBOARD_ORIGIN` (that is the CSRF protection). Page guards run on the
server: `src/proxy.ts` sends visitors without the cookie to `/login`, and the workspace layout asks
`{API}/auth/me` who is signed in.

### Backend settings

Set these on ton-observer (its `.env`), then restart it:

| ton-observer variable | Value | Why |
|---|---|---|
| `DASHBOARD_ORIGIN` | this dashboard's exact origin, locally `http://localhost:3100` | The API accepts writes only from this `Origin` and allows CORS for it. Any other origin gets `403 bad_origin`. |
| `GOOGLE_REDIRECT_URL` | `<DASHBOARD_ORIGIN>/auth/google/callback`, locally `http://localhost:3100/auth/google/callback` | Google must return to the dashboard's host, so the session cookie (and the `Path=/auth/google` state cookie) are set where the dashboard can read them. Register the same URL in the Google console. |

## Run locally

Requires Node ≥ 24, pnpm and a running ton-observer (default `http://localhost:3000`) configured as above.

```sh
cp .env.example .env.local
pnpm install
pnpm dev          # then open http://localhost:3100
```

Browse via **`http://localhost:3100`** with **Chrome or Firefox**, not `127.0.0.1`. The session
cookie is `Secure`, and browsers keep a Secure cookie over plain http only on `localhost`. Safari
rejects it on http, so sign-in doesn't stick there.

Production build: `pnpm build && pnpm start` (same port). In production, serve the dashboard over
https at exactly the origin set as `DASHBOARD_ORIGIN`.

`pnpm dev` and `pnpm start` go through `scripts/next.mjs`: Next itself never reads `PORT` from
`.env` files (the server binds before they load), so the script loads `.env` and `.env.local` first
and passes `-H 127.0.0.1 -p $PORT`.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `PORT` | no | `3100` | port for `pnpm dev` / `pnpm start` (ton-observer uses 3000). A shell value wins over `.env.local`, which wins over `.env`. |
| `OBSERVER_API_URL` | no | `http://localhost:3000` | ton-observer base URL, used server-side only |

## Checks

| Command | What |
|---|---|
| `pnpm typecheck` | TypeScript (run `pnpm exec next typegen` first on a clean checkout) |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest: forwarding, proxy, `getMe`, roles, client errors, sign-in, nav and the page components (`tests/unit`) |
| `pnpm e2e` | The visual gate (`tests/e2e/visual.spec.ts`): every route, for the users it matters to, at 1440 and 390, light and dark. No sideways scroll, axe without serious/critical findings, screenshots in `shots/`, HTML in `shots/html/`. Runs a minimal fake ton-observer (`tests/fake-observer`, port 3999; the `__Host-session` value picks the user: `admin`, `owner`, `editor`, `viewer`, `none`) and a production build on port 3110. Uses the system Chrome (`channel: "chrome"`). |

Not covered automatically: real Google sign-in, the API's `Origin` check and cookie behaviour
against a real ton-observer. Check those by hand after changing the transport.

### Design checks (taste skill)

```sh
node ~/.claude/skills/design-taste-frontend/scripts/copy-lint.mjs shots/html/*.html
node ~/.claude/skills/design-taste-frontend/scripts/shoot.mjs --url http://localhost:3100/login --w 1440 --out shots/login.png --profile .taste-skill/chrome-shoot
node ~/.claude/skills/design-taste-frontend/scripts/perf.mjs http://localhost:3100/login --profile .taste-skill/chrome-perf
```

## Layout

```
src/proxy.ts                  page guard: no session cookie → /login?next=…; clears v1 cookies
src/server/                   env, the forwarder (forward.ts) and getMe (me.ts); server only
src/app/auth/[...path]/       /auth/* → ton-observer /auth/*
src/app/api/[...path]/        allowlisted /api/* → ton-observer; /api/health has its own route
src/app/login/                sign-in page
src/app/(workspace)/          signed-in pages: / , /projects/[id]/…, /admin, /admin/users, /account
src/app/dev/kit/              dev-only component sheet
src/features/                 screens + their data hooks: auth, home, project, members, admin, account
src/components/               ui kit, chain values (address/hash/amount), shell and nav, chart
src/lib/                      client fetch and errors, roles, types, TON helpers, formatting, paging, feed
tests/unit/                   Vitest
tests/e2e/, tests/fake-observer/   the Playwright visual gate and its fake API
```
