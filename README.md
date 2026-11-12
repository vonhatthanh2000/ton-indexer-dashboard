# ton-observer dashboard

A Next.js dashboard for the [ton-observer](../ton-observer) indexer:

- **Admin** workspace (REST, admin key): projects, API keys, a project's addresses.
- **Project manager** workspace (GraphQL, project key): addresses and transactions of one project.

The browser only talks to this app's `/api/*` routes. The Next server keeps the key in an encrypted
httpOnly cookie (12 h at most) and calls ton-observer itself, so keys never reach page JavaScript.

Specs: `dashboard-spec.md` (what the API serves), `ui-build-plan.md` (look and components),
`tasks/2026-11-12-dashboard-v1/PLAN.md` (what was built).

## Run locally

Requires Node ≥ 24, pnpm and a running ton-observer (default `http://localhost:3000`).

```sh
cp .env.example .env.local
# set SESSION_SECRET to 32+ random characters, e.g.
node -e "console.log(require('crypto').randomBytes(33).toString('base64'))"
pnpm install
pnpm dev          # http://127.0.0.1:3100
```

Sign in with:

- **Admin key**: the `ADMIN_API_KEY` set on ton-observer.
- **Project key**: the key shown once when a project is created (or rotated).

Production build: `pnpm build && pnpm start` (also port 3100).

| Variable | Required | Default | Notes |
|---|---|---|---|
| `OBSERVER_API_URL` | no | `http://localhost:3000` | ton-observer base URL, used server-side only |
| `SESSION_SECRET` | yes | — | ≥ 32 chars; `dev` and `start` exit if it is missing. `build` does not need it. |

## Checks

| Command | What |
|---|---|
| `pnpm typecheck` | TypeScript (run `pnpm exec next typegen` first on a clean checkout) |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests (`tests/unit`) |
| `pnpm e2e` | Playwright against a fake ton-observer (`tests/fake-observer`, port 3999) and a production build on port 3110. Uses the system Chrome (`channel: "chrome"`). |
| `pnpm e2e tests/e2e/visual.spec.ts` | Every route at 1440 and 390, light and dark: no sideways scroll, axe (no serious/critical), screenshots in `shots/`, HTML in `shots/html/` |
| `pnpm e2e:real` | One smoke test against a real ton-observer (below) |

### Real smoke test

1. In `../ton-observer`: a `.env` with `DATABASE_URL` and `ADMIN_API_KEY`, then
   `docker compose up -d --wait db`, `pnpm install`, `pnpm migrate:latest`, `pnpm start`.
   The worker is not needed; the registered address stays "Pending start".
2. Here: `pnpm dev` (or `pnpm build && pnpm start`).
3. `REAL_ADMIN_KEY=<ADMIN_API_KEY> pnpm e2e:real`
   (`REAL_DASHBOARD_URL` defaults to `http://127.0.0.1:3100`).

It creates a project named `smoke-<timestamp>`, registers the USDT master "from now", signs in with
the new project key and checks the address is listed.

### Design checks (taste skill)

```sh
node ~/.claude/skills/design-taste-frontend/scripts/copy-lint.mjs shots/html/
node ~/.claude/skills/design-taste-frontend/scripts/shoot.mjs --url http://127.0.0.1:3100/login --w 1440 --out shots/login.png --profile .taste-skill/chrome-shoot
node ~/.claude/skills/design-taste-frontend/scripts/perf.mjs http://127.0.0.1:3100/login --profile .taste-skill/chrome-perf
```

## Layout

```
src/proxy.ts            page guard: no/expired session → /login?next=…
src/server/             env, session cookies, upstream proxy helper (server only)
src/app/api/**          the allowlisted proxy routes (anything else is a JSON 404)
src/app/{login,admin,project}/   pages; src/app/dev/kit is a dev-only component sheet
src/features/           admin, project and auth screens + their data hooks
src/components/         ui kit, chain values (address/hash/amount), shell, chart
src/lib/                client fetch, errors, TON address/amount helpers, formatting, paging, feed
```
