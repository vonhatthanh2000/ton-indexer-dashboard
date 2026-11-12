# ton-observer Dashboard – UI Build Plan (Next.js)

Kind: **software** (an internal admin tool, signed in; not a marketing site).
Source of truth for features: `dashboard-spec.md`. Visual spec: `dashboard-plan.md` §2–4.
Design rules: tasteskill 2.5 (`~/.claude/skills/design-taste-frontend`), the layers that apply to
an app are listed in §1.

---

## 1. How the taste skill applies to a dashboard

The skill is written for public company sites. A signed-in dashboard has no hero, no photos and no
one-section-per-screen layout, so only part of it applies.

| Skill layer | Use here | How |
|---|---|---|
| One system (`system.md`): one spacing scale, one radius family, one button pair, one card recipe, one hairline, one link look | **yes, strict** | §3 tokens, §5 components |
| Type pairing dealt by `start.mjs` | **yes** | Dealt: onest, **manrope**, instrument. We take **Manrope + JetBrains Mono**, the second one, because the spec asks for a *geometric* sans and Manrope is the geometric option ("fintech, data… open numbers"). |
| Palette dealt by `start.mjs` | **no** | The spec fixes the brand colours (`#465FFF` primary, hue ≈231°, blue, not violet ✔). These count as the client's own colours. |
| Motion tokens and hover layer (`motion.md`) | **yes** | §6 |
| Copy rules (`copy.md`): headings name things, buttons are a verb + an object, no invented figures, no slop | **yes** | §7 |
| Access (`system.md` Access): named controls, visible focus, skip link, `aria-expanded`, 44px targets, contrast | **yes** | §8 |
| Forms (`system.md` Forms): visible labels, error under its field, first failed field takes focus, one status line | **yes** | §5.6 |
| Real full-colour icons (`icons.mjs`) | **partial** | Real TON logo for the network pill. UI icons are an outline set (spec §2.5): `lucide-react`, 20px, stroke 1.5. |
| Static export (`output: 'export'`, checked from `out`) | **yes** | §2 |
| Hero, section heights, photographs, moments, shader grounds, scenes, diagram cards, card loops | **no** | Not part of an app shell. |
| `gate.mjs` finish gate | **no** (waived) | It checks hero, section heights and moments, and every one would FAIL on an app. We run `copy-lint`, `shoot`, `perf` instead and test with Playwright (§10). `start.mjs` armed the gate in this folder; it gets closed with `gate.mjs --done` and that reason. |

---

## 2. Stack and project setup

> **Replaced by `tasks/2026-11-12-dashboard-v1/PLAN.md` (Decisions):** the app runs as a Next.js server acting as a proxy (BFF). There is no static export, no dev rewrites and no `?id=` routes. Keys live in httpOnly cookies. The library choices below still apply.

| Piece | Choice | Why |
|---|---|---|
| Framework | **Next.js 16.4** App Router, TypeScript strict | You asked for Next.js |
| Output | `output: 'export'` → static `out/` | Every call is made in the browser with a key from the session, so no Next server is needed. The `out/` folder is served behind the same traefik host as the API. |
| Styling | **Tailwind CSS 4.3**: CSS variables on `:root` / `[data-theme=dark]`, mapped through `@theme` | Tokens in one place; dark mode is a variable swap |
| Server state | **TanStack Query 5** | Cache, retries off for 4xx, `invalidateQueries` after a mutation |
| GraphQL | Small typed `gql()` wrapper around `fetch` (no Apollo) | 2 queries; aliasing for the multi-address feed |
| TON | **@ton/core 0.63**: `Address.parseRaw(raw).toString({ urlSafe: true, bounceable: true })` | Friendly `EQ…` form; raw form in the tooltip |
| Tables | Hand-written `<table>` + client-side filtering and paging helpers | Small data sets; no TanStack Table needed |
| Chart | **Recharts** (one bar chart) | Spec §4.2 |
| Icons | `lucide-react` | Thin outline set |
| Fonts | `next/font/google`: Manrope (400/500/600/700), JetBrains Mono (400/500) | Self-hosted at build time, no layout shift |
| Identicon | `boring-avatars` "beam", or a 30-line hash → 5×5 SVG | Address and project avatars |
| Toasts | `sonner` | Success toasts (spec §6.3) |
| Tests | Vitest + Testing Library (units), Playwright (flows, screenshots) | §10 |

### Routes: static export has no dynamic segments, so ids go in the query string

```
/login                         two tabs: Admin key | Project key
/admin                         Dashboard
/admin/projects                Projects list
/admin/projects/new            Create project
/admin/projects/view?id=<uuid> Project addresses
/admin/settings
/project                       Dashboard
/project/addresses
/project/transactions?address=<raw|friendly>
/project/settings
/                              → redirect by stored role (client), else /login
```

### API base: same origin, three paths

`next.config.ts`:
- `output: 'export'` only when `NODE_ENV === 'production'`.
- In dev, `rewrites()` sends `/projects/:path*`, `/graphql`, `/health/:path*` to
  `process.env.OBSERVER_API_URL` (default `http://localhost:3000`). Run the dashboard dev server
  on port **3100**, because ton-observer already uses 3000.
- `images: { unoptimized: true }`, `trailingSlash: true` (each route becomes `out/<route>/index.html`).

Prod: a traefik router on the API host serves `out/` for `/` and sends the three API paths to the
API service. CORS stays off (spec F21 is then not needed).

### Folder layout

```
src/
  app/
    layout.tsx              fonts, <html lang="en" data-theme>, QueryProvider, Toaster
    globals.css             tokens (§3), base, Tailwind @theme
    login/page.tsx
    admin/layout.tsx        RoleGate role="admin" + AppShell(adminNav)
    admin/page.tsx
    admin/projects/page.tsx
    admin/projects/new/page.tsx
    admin/projects/view/page.tsx
    admin/settings/page.tsx
    project/layout.tsx      RoleGate role="project" + AppShell(projectNav)
    project/page.tsx …
  components/
    shell/   AppShell, Sidebar, SidebarProjectCard, TopBar, PageHeader, Breadcrumb,
             CommandSearch (⌘K), ThemeToggle, ApiStatusDot, UserMenu
    ui/      Card, Button, Input, Textarea, RadioGroup, Select, Pill, KpiCard, TableCard,
             DataTable, Pagination, LoadMore, Menu (⋮), Dialog, Drawer, Tooltip, Skeleton,
             EmptyState, NoAccess, CopyButton, MonoBox
    chain/   AddressChip, HashChip, LtText, TonAmount, RelativeTime, Identicon, NetworkPill
    charts/  BarChartCard
  features/
    auth/    session.ts (sessionStorage), RoleGate, useSession, signIn checks
    admin/   api.ts (REST), hooks.ts, ProjectsTable, CreateProjectForm, ApiKeyModal,
             RotateKeyDialog, AddressesTable, RegisterAddressesDrawer, ProjectKeyPrompt
    project/ graphql.ts (queries), hooks.ts, LatestTransactions, TransactionsTable,
             TxRowDetail, AddressSelector, AddressesTable
  lib/
    http.ts        fetch wrapper: headers, JSON, ApiError{status, code, field, index, problem}
    gql.ts         POST /graphql, GraphQLError{code, message}
    errors.ts      code → user text (one table, §7)
    ton.ts         toFriendly, toRaw, isTonAddress, nanoToTon (BigInt, 9 decimals)
    format.ts      compactNumber, relativeTime, fullTimestamp
    paging.ts      client-side filter + slice
```

---

## 3. Design tokens (`globals.css`)

One scale for everything. Spacing follows the skill's scale; colour, radius and type follow the spec.

```css
:root {
  /* colour, spec §2.2 */
  --bg:#F9FAFB; --surface:#FFFFFF; --border:#E4E7EC; --border-strong:#D0D5DD;
  --primary:#465FFF; --primary-hover:#3641F5; --primary-soft:#ECF3FF;
  --ink:#1D2939; --ink-2:#667085; --ink-3:#98A2B3;
  --ok:#039855; --ok-soft:#ECFDF3; --warn:#DC6803; --warn-soft:#FFFAEB;
  --err:#D92D20; --err-soft:#FEF3F2; --neutral-soft:#F2F4F7;
  /* spacing, skill scale */
  --s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:24px; --s-6:32px; --s-7:48px; --s-8:64px;
  /* radius, spec §2.4 */
  --r-card:16px; --r-control:10px; --r-sm:8px; --r-pill:999px;
  /* layout */
  --sidebar:290px; --sidebar-collapsed:88px; --topbar:72px; --row:64px; --ctl-h:44px;
  /* motion, skill motion.md */
  --m-in:150ms; --m-out:120ms; --m-press:90ms; --m-panel:200ms; --ease:cubic-bezier(.2,0,0,1);
}
[data-theme="dark"] {
  --bg:#0C111D; --surface:#1A2231; --border:#2A3445; --border-strong:#344054;
  --primary-soft:rgba(70,95,255,.14); --ink:#F2F4F7; --ink-2:#98A2B3; --ink-3:#667085;
  --ok-soft:rgba(3,152,85,.15); --warn-soft:rgba(220,104,3,.15); --err-soft:rgba(217,45,32,.15);
  --neutral-soft:#232C3D;
}
```

- **Type scale (one):** page title 24/32 semibold · card title 18/28 semibold · KPI 30/38 bold
  (`font-variant-numeric: tabular-nums`) · body/table 14/20 · label 12/18 and 14/20 in `--ink-2`.
  Headings use Manrope with letter-spacing −1%. Mono (JetBrains Mono, 13px) is used only for
  addresses, hashes, lt, UUIDs and keys.
- **Theme:** `data-theme` on `<html>`. A tiny inline script in `layout.tsx` reads `localStorage`
  (in a try/catch), falls back to `prefers-color-scheme`, and sets the attribute before first paint.
- **Contrast check before build:** `--ink-2` on `--surface` and every pill pair must reach ≥ 4.5:1
  in both themes. `#DC6803` on `#FFFAEB` is about 3.3:1, so warn text is darkened to `#B54708`.
- **Layout grid:** content area padding 24px (16px on mobile), 12-column grid, 24px gap.

---

## 4. App shell

- **Sidebar** (`<nav aria-label="Main">`):
  - Logo, with the "Admin" pill for admins or the project card for managers.
  - Groups labelled `MENU` / `SUPPORT` (12px uppercase, `--ink-3`, tracking 4%).
  - Items are 44px high with `--r-control` corners. The active item gets `--primary-soft` with
    primary icon and text, plus `aria-current="page"`.
  - Collapsed (88px): icons only, with a tooltip for each label.
- **Top bar:**
  - Hamburger: a 44px square with a border and `aria-expanded`. It collapses the sidebar on
    desktop and opens the drawer on mobile.
  - Search: opens a ⌘K command dialog. Admins search project names; managers search addresses.
  - Right side: ApiStatusDot (polls `/health/ready` every 30 s, label "API online" or "API
    unreachable"), ThemeToggle (round 40px button inside a 44px hit area), then UserMenu
    ("Admin" or the project name, a menu with **Sign out**).
  - No bell icon (spec F20).
- **Skip link** ("Skip to content") is the first focusable element and targets `<main id="main">`.
- **PageHeader:** title on the left; on the right a Breadcrumb with the current page in
  `--primary` and `aria-current`.
- **Responsive (spec §8):** ≥1280 full sidebar · 768–1279 icon rail and 2 KPI columns · <768 the
  sidebar becomes a drawer (focus trapped, Esc closes it, closes on navigation), cards stack in one
  column, tables scroll sideways inside their card (the page itself never scrolls sideways).

---

## 5. Components (spec §4, under the one-system rule)

### 5.1 Card
Surface, 1px `--border`, `--r-card`, padding 24 (16 on mobile), no shadow. A **linked** card
(Recent project row cards, "View all") gets the hover lift. A static card never moves.

### 5.2 Button: one pair
- Primary: filled `--primary`, white text, 44px, `--r-control`, 500 weight.
- Secondary: surface fill, 1px `--border-strong` border.
- Icon button: square 44px, secondary look.
- Destructive actions (Unlink, Rotate key confirm) use the **primary shape in `--err`**, and only
  inside a confirm dialog. A screen never shows two filled buttons.

### 5.3 KpiCard
48px `--neutral-soft` rounded square with a 20px icon → label → KPI number. No change pill (there
is no history: spec F10). Skeleton: same blocks in grey.

### 5.4 TableCard + DataTable
- Header: title + subtitle on the left; search / actions on the right. Header row 12px in `--ink-2`.
- Rows are 64px with a 1px divider. Clickable rows: the whole row is a link, gets a `--bg` hover
  tint, and is keyboard-reachable through the first cell's link.
- `Pagination`: 32px rounded square buttons, active page filled primary, Prev/Next.
- `LoadMore`: secondary button "Load older transactions" with a spinner while loading.
- Empty, loading (5 skeleton rows) and error (inline message + "Try again") states live in the card.

### 5.5 Chain primitives
- **AddressChip:**
  - 20px identicon, then the friendly address cut to `EQD4…9c21` in mono and primary as a link.
  - Tooltip shows the full friendly and raw forms.
  - **CopyButton:** the glyph swaps to a check for 1.5 s, and an `aria-live` label says "Copied".
- **HashChip:** base64 hash cut to `Ab3x…Q9w=`, with CopyButton. No link (there is no hash lookup yet).
- **TonAmount:** `nanoToTon` with BigInt, shown as `1.24 TON` (compact above 1M), exact nanotons
  in the tooltip.
- **LtText:** mono, digits grouped by thin spaces, tooltip "logical time".
- **RelativeTime:** `<time dateTime>`, relative text, full local timestamp in the tooltip. Updates
  every minute.
- **Pills:** Success · Failed · Live · Syncing · Pending start · Error · Network (`TON` with its
  real logo from `icons.mjs`, else a cyan dot). Every pill has a text label, never colour alone.

### 5.6 Forms
- Visible labels, 44px inputs, 1px border, primary focus border + the 2px focus ring.
- The error shows under its own field; the first failed field takes focus; one `role="status"`
  line under the buttons.
- Server field errors (`field`, `index`, `problem`) map to that field. In the address textarea the
  offending line is highlighted in a line-numbered gutter.
- A button stays enabled until pressed; while sending it shows a spinner and its own verb
  ("Creating…").

### 5.7 Dialogs and drawers
Radix-style (built on `@radix-ui/react-dialog`/`dropdown-menu`/`tooltip` for focus handling):
Esc closes, focus returns to the trigger, title is labelled. **ApiKeyModal** cannot be dismissed
by clicking outside. It closes only through its buttons, so the one-time key is not lost by
mistake.

---

## 6. Motion (skill `motion.md`)

| Element | Motion | Timing |
|---|---|---|
| Button | hover: fill steps toward the ink, rises 1px · press: 1px down, scale .985 | 150 in / 120 out / 90 press |
| Linked card | lifts 2px, border one step darker | 180 in / 120 out |
| Table row link | background tint only (no lift: rows are not cards) | 150 |
| Text link | underline draws in from the left | 150 |
| Sidebar collapse | width by `grid-template-columns` transition on the shell; labels fade | 200 |
| Menu / dialog | fade + 6px drop | 200 open / 120 close |
| Copy | glyph swaps to a check, holds 1.5 s | 150 |
| Skeleton | soft shimmer, still under reduced motion | 1.6 s |

- Hover moves only under `(hover: hover) and (pointer: fine)`. Focus shows the same state with a
  2px `--primary` ring, 2px offset, and no transition.
- No scroll-triggered fades, no tilt, no count-up numbers (counts are internal data, so they are
  shown as they are), no carousels.
- `prefers-reduced-motion`: transforms off, only colour changes remain, shimmer stops.
- Only `transform`, `opacity` and colours animate.

---

## 7. Copy

One voice: plain, short, says what happened. Sentence case everywhere.

- **Buttons (verb + object):** "Create project" · "Register addresses" · "Rotate API key" ·
  "Unlink address" · "Copy key" · "Load older transactions" · "Sign in" · "Sign out" ·
  "View all projects".
- **Headings name the thing:** "Projects", "Recent projects", "Projects created per month",
  "Latest transactions", "Addresses of <name>".
- **No invented numbers:** every figure on screen comes from the API. No sample or demo data in the
  build. Dev fixtures live only in tests.
- **Error table** (`lib/errors.ts`, one place):

| Code | Text |
|---|---|
| `missing_admin_key` / `invalid_admin_key` | That admin key is not valid. |
| `admin_disabled` | The admin API is turned off on this server (ADMIN_API_KEY is not set). |
| `invalid_api_key` / `UNAUTHENTICATED` | That project key is not valid. It may have been rotated. |
| `project_exists` | A project with this name already exists. |
| `invalid_request` + `field: name` | Name `<problem>`. |
| `invalid_request` + `field: addresses, index` | Line `<index+1>` `<problem>`. |
| `address_not_linked` | This address is no longer linked. The list was refreshed. |
| `FORBIDDEN` | This address is not linked to your project. |
| `BAD_USER_INPUT` | the server's message (it names the argument, never a value) |
| `internal_error` / network | Something went wrong on the server. Try again. |

- **Empty states:** "No projects yet" + **Create project** · "No addresses yet. Ask your admin to
  register them." · "No transactions stored yet. History may still be syncing."
- **One-time key warning:** "This key is shown only once. Copy it now and give it to the project
  manager."

---

## 8. Access checklist (from skill `system.md`)
- Every icon-only button has an `aria-label`. Every table has a `<caption class="sr-only">`.
- Headings go one level at a time (h1 page title → h2 card titles).
- No `tabindex` above 0. The skip link is the first Tab stop. A focused control is never hidden
  under the top bar.
- Targets outside running text are 44px with at least 8px between them. The 32px pagination
  buttons get a 44px hit area through padding.
- `lang="en"`, a title per route (`"Projects · ton-observer"`), description, theme-color.
- Copy and toast messages are announced through `aria-live="polite"`.

---

## 9. Data layer

### 9.1 Session

> **Replaced by `tasks/2026-11-12-dashboard-v1/PLAN.md`:** encrypted httpOnly cookies `tonobs_session` / `tonobs_pkeys`, not sessionStorage. The text below is out of date.
- `sessionStorage['tonobs.session'] = { role: 'admin' | 'project', key, project?: { id, name } }`.
  Every read and write is wrapped in try/catch; when storage is missing the app falls back to
  memory.
- `RoleGate`: without a session it goes to `/login?next=`; with the wrong role it shows `NoAccess`.
  Any 401 or `UNAUTHENTICATED` clears the session and goes to `/login?reason=expired`.
- **Project keys for admins (spec §4.5):** keys shown at create or rotate are kept in a memory map
  `projectId → key` (never stored) so the addresses page can use them in the same session.

### 9.2 Query keys and calls

| Hook | Call | Key | Notes |
|---|---|---|---|
| `useProjects` | `GET /projects` | `['admin','projects']` | Dashboard, list, ⌘K; `staleTime` 30 s |
| `useCreateProject` | `POST /projects` | invalidates projects | returns the key → ApiKeyModal |
| `useRotateKey` | `POST /projects/:id/api-key` | invalidates projects | |
| `useProjectAddresses(id, key, page)` | `GET /projects/:id/addresses?limit=100&offset=` | `['admin','addresses',id,offset]` | Next is turned off when a page returns fewer than 100 rows |
| `useRegisterAddresses` | `POST …/addresses` | invalidates addresses | the result list is shown in the drawer |
| `useUnlinkAddress` | `DELETE …/addresses/:raw` | optimistic removal, rolled back on error | |
| `useHealth` | `GET /health/ready` | `['health']` | `refetchInterval` 30 s |
| `useMyProject` | `query { project { … } }` | `['pm','project']` | sidebar, KPIs, address list |
| `useLatestFeed(addresses)` | one aliased query, `limit: 10` per address, first 20 addresses | `['pm','feed']` | merged by `utime` desc then `lt` (BigInt) |
| `useTransactions(address)` | `transactions(address, limit:20, beforeLt)` | `['pm','tx',address]`, `useInfiniteQuery` | next cursor = last `lt`; done when < 20 rows |

- Retries: none on 4xx, once on network or 5xx.
- `refetchOnWindowFocus` is on for the PM dashboard so the feed stays fresh.
- Aliased query is built safely: aliases are `a0…aN`, addresses are passed as **variables**
  (`$a0: String!`), never pasted into the query text.

---

## 10. Checks

| When | Check |
|---|---|
| Every PR | `tsc --noEmit`, ESLint, Vitest: `ton.ts` (raw↔friendly, nano→TON with BigInt edge cases), `errors.ts` mapping, feed merge order, paging helpers, address-textarea validation |
| Every PR | Playwright against `next dev` with the API mocked by `page.route`: sign in (both roles), wrong role → No access, 401 → back to login, create project → key modal, rotate key, register addresses with a server error on line 3, unlink, transactions Load more |
| Before demo | Playwright against a real ton-observer (docker Postgres + `ADMIN_API_KEY`) |
| Visual | `node <skill>/scripts/shoot.mjs` (dev server URL) at 1440, 1024, 768, 390, in light and dark, for each route; check by eye against §3–6 |
| Copy | `node <skill>/scripts/copy-lint.mjs` on the built `out/**/index.html` |
| Speed | `node <skill>/scripts/perf.mjs` on `out/admin/index.html` (font loading, layout shift: skeletons must keep the size of the content they stand in for) |
| Access | `@axe-core/playwright` on each route, 0 serious findings; a keyboard-only pass of every flow |

---

## 11. Build order (one PR each)

| # | Step | Done when |
|---|---|---|
| 1 | Scaffold: Next 16 + TS + Tailwind 4 + config (export, dev rewrites, port 3100), fonts, tokens, theme script, ESLint/Vitest/Playwright | `pnpm dev` shows a blank shell in both themes; `pnpm build` writes `out/` |
| 2 | `lib/` (http, gql, errors, ton, format, paging) + unit tests | tests green |
| 3 | UI kit: Card, Button, Input, Pill, Tooltip, Skeleton, EmptyState, Dialog, Drawer, Menu, CopyButton, chain primitives | a `/dev/kit` page (left out of the export) shows every state, shot at 1440 and 390 |
| 4 | Shell: Sidebar (both navs), TopBar, drawer, collapse, ⌘K, ApiStatusDot, PageHeader | keyboard pass; responsive at 1440/1024/768/390 |
| 5 | Auth: login tabs, session, RoleGate, NoAccess, 401 handling, sign out | Playwright auth specs |
| 6 | Admin: Dashboard (KPIs, bar chart, recent projects) + Projects table | real API shows the list |
| 7 | Admin: Create project + ApiKeyModal + Rotate key | key shown once; toast; list refreshed |
| 8 | Admin: Project addresses (key prompt, table, register drawer, unlink) | server field errors land on the right line |
| 9 | PM: Dashboard (KPIs, latest feed) + Addresses | aliased feed on a 3-address project |
| 10 | PM: Transactions (selector, infinite paging, row detail, local search) | Load more stops at the end |
| 11 | Settings (both), empty and error states everywhere, polish pass with `shoot.mjs` in both themes, axe, perf | §10 all green |
| 12 | Deploy: traefik router for `out/` + API paths (`docker/` stack), `README` run notes | dashboard served on the API host |

---

## 12. Open questions
1. **Hosting:** the plan assumes the dashboard is served on the **same host** as the API (no CORS).
   If it must live on another domain, ton-observer needs `enableCors` (spec F21).
2. **Address form:** show bounceable `EQ…` (contracts) or non-bounceable `UQ…` (wallets) by
   default? The plan uses `EQ…`; the raw form is always one click away.
3. **Explorer links:** link addresses to tonviewer / tonscan in a new tab? Not in the spec; easy to
   add to AddressChip.
