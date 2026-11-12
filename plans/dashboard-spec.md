# ton-observer Dashboard – Spec v1 (current API only)

Revision of `dashboard-plan.md`, cut down to what the **ton-observer** backend
(`~/Desktop/ton/ton-observer`) serves today. Everything the plan asks for that the
API cannot serve yet is listed in **§9 Future (needs backend work)**.

- **Admin workspace** → REST (`/projects…`, header `X-Admin-Key`)
- **Project Manager workspace** → GraphQL (`/graphql`, header `X-API-Key`)

The chain is **TON** (not EVM): addresses are `0:ABC…` / `EQ…` / `UQ…`, amounts are
nanotons, transaction hashes are base64, ordering is by logical time (`lt`).

---

## 1. Backend API this dashboard uses

### 1.1 REST (admin)

| Method | Path | Auth | Reply | Errors to show |
|---|---|---|---|---|
| `GET` | `/projects` | `X-Admin-Key` | `{ projects: [{ id, name, createdAt, activeAccounts }] }` sorted by name, no paging | 401 `missing_admin_key` / `invalid_admin_key`, 503 `admin_disabled` |
| `POST` | `/projects` | `X-Admin-Key` | 201 `{ project: { id, name, createdAt }, apiKey }` (**key shown only once**) | 400 `invalid_request` + `field: "name"`, `problem`; 409 `project_exists` |
| `POST` | `/projects/:projectId/api-key` | `X-Admin-Key` | 200 `{ project, apiKey }`; the old key stops working at once | 400 `invalid_project_id`, 404 `project_not_found` |
| `GET` | `/projects/:projectId/addresses?limit&offset` | **project** `X-API-Key` | `{ addresses: [{ address, sourceId, state, startLt, lastLt, stillSyncing, lastError }], limit, offset }` (limit 1–1000, default 100) | 401 `invalid_api_key` |
| `POST` | `/projects/:projectId/addresses` | **project** `X-API-Key` | body `{ addresses: [1..100], startLt: "now" \| "<decimal lt>" }` → `{ addresses: [{ address, sourceId, created, linked, stillSyncing }] }` | 400 `invalid_request` + `field`, `index`, `problem` |
| `DELETE` | `/projects/:projectId/addresses/:address` | **project** `X-API-Key` | 204 (unlinks; data stays) | 404 `address_not_linked` |
| `GET` | `/health/ready` | none | Postgres reachable or not | — |

Error body is always `{ "error": "<code>", field?, index?, problem? }`.
OpenAPI is served at `/docs`.

### 1.2 GraphQL (project manager)

```graphql
# The key alone names the project.
query { project { id name addresses { address state startLt lastLt stillSyncing } } }

# One address per call; newest first; page with beforeLt = last row's lt.
query ($address: String!, $limit: Int = 20, $beforeLt: String) {
  transactions(address: $address, limit: $limit, beforeLt: $beforeLt) {
    hash lt utime time traceId inMsgOpcode sender value aborted fee
    outMsgs { destination value opcode }
  }
}
```

Error codes in `extensions.code`: `UNAUTHENTICATED` (missing/invalid key),
`FORBIDDEN` (address not linked to this project), `BAD_USER_INPUT` (message names the
argument, e.g. `limit: must be between 1 and 100`).

### 1.3 Facts the UI must respect
- `state` is `live` or `resyncing`. `stillSyncing` = history below the start is still
  being fetched. `startLt` is `null` while a `"now"` start is pending.
- `value`, `fee` are nanoton strings → show as TON (÷ 10⁹), exact value in tooltip.
- `lt`, `utime` are bigint strings: never parse with `Number` for comparison; use `BigInt`.
- Addresses come back **raw uppercase** (`0:4F3A…`). Show the friendly form
  (`EQ…`/`UQ…`) via `@ton/core`, raw form in the tooltip and copy menu.
- `aborted`: `false` → Success, `true` → Failed, `null` → "—". There is no Pending
  (only finalized transactions are indexed).
- No server-side totals or counts exist except `activeAccounts` per project.

---

## 2. Visual style

Unchanged from `dashboard-plan.md` §2 (colors, dark mode, typography, 16px cards,
24px gap/padding, thin outline icons), with these adjustments:

- **Monospace** for addresses, tx hashes, `lt`, project IDs and API keys.
- **Hash / address chip** (plan §4.4): identicon from the raw address; truncate as
  `EQD4…9c21` (friendly) or `0:4F3A…9C21` (raw); hashes as `Ab3x…Q9w=`.
  Copy icon → "Copied" tooltip.
- **Pills**

  | Pill | Color | Source |
  |---|---|---|
  | Success | green | `aborted = false` |
  | Failed | red | `aborted = true` |
  | Live | green | `state = live` and not `stillSyncing` |
  | Syncing | orange | `state = resyncing` or `stillSyncing` |
  | Pending start | gray | `startLt = null` |
  | Error | red | `lastError` not null (admin / REST only) |
  | Network | gray + dot | fixed `TON` (one chain only) |

  Removed: `Pending` tx status, `Active/Paused`, `Invited`, `ERC20` type pills.
- **Time:** relative ("2 minutes ago") from `time`/`createdAt`, full timestamp tooltip.
- **Amounts:** `1.24 TON`, compact for big numbers (`1.24M TON`), exact nanotons in tooltip.

Layout (plan §3) and components (plan §4) stay, except:
- **Table pagination:** admin tables paginate **client-side** (the list is unpaged);
  transaction tables use a **"Load more"** button (cursor `beforeLt`), because there is
  no total count.
- **Top bar search (⌘K):** jumps to a project by name (admin) or to an address
  (manager), filtered client-side. No global hash search.
- **Notifications button:** dropped (no source of events).
- **API status dot** in the top bar from `GET /health/ready` (green / red).

---

## 3. Sign-in & access

There are no users in the backend, only keys. One sign-in page with two tabs:

| Tab | Input | Check | Redirect |
|---|---|---|---|
| **Admin** | admin key | `GET /projects` with `X-Admin-Key` → 200 | `/admin` |
| **Project** | project API key | GraphQL `{ project { id name } }` → no error | `/project` |

- Key kept in `sessionStorage` (cleared when the tab closes), sent as a header on
  every call. "Sign out" in the avatar menu clears it.
- Any 401 / `UNAUTHENTICATED` → back to sign-in with "Key is no longer valid"
  (e.g. after an admin rotated it). 503 `admin_disabled` → "Admin API is disabled on
  this server".
- Scoping is already enforced by the server: a project key only sees its own project
  and its linked addresses (`FORBIDDEN` otherwise).
- Visiting `/admin` with a project key (or the reverse) → "No access" empty state.
- Avatar area shows "Admin" or the project name instead of a user name.

---

## 4. Admin workspace (REST)

**Sidebar** – MENU: Dashboard · Projects. SUPPORT: Settings. "Admin" pill next to logo.

### 4.1 Dashboard
Data: one `GET /projects`.
- **Row 1 – KPI cards:** Total projects · Linked addresses (sum of `activeAccounts`) ·
  Projects without addresses (`activeAccounts = 0`). No change pills (no history).
- **Row 2 – Bar chart "Projects created per month"** (grouped from `createdAt`).
- **Row 3 – "Recent projects"** table: 5 newest by `createdAt`, "View all →".

### 4.2 Projects
Table card, header button **+ Create project**, search by name (client-side),
client-side pagination (10 / page).

| Column | Content |
|---|---|
| Project | Identicon + name |
| Project ID | UUID chip with copy |
| Addresses | `activeAccounts` |
| Created | Relative time |
| Actions | ⋮ menu: **View addresses**, **Rotate API key** |

### 4.3 Create project
Form card with one field:
- **Project name** – required, 1–64 chars, trimmed, no control characters (checked in
  the form and on the server). 409 → inline "A project with this name already exists".
- Buttons: **Cancel** (secondary), **Create** (primary).

On success: a modal **"Project API key"** with the key in a mono box, copy button and
the warning *"This key is shown only once. Give it to the project manager now."*
Modal buttons: **Register addresses now** (opens 4.5 with the key kept in memory) and
**Done** (→ Projects list, success toast).

### 4.4 Rotate API key
Confirm dialog: *"The current key of `<name>` stops working immediately."* →
`POST /projects/:id/api-key` → same one-time key modal as 4.3.

### 4.5 Project addresses
Route `/admin/projects/:id`. These routes need the **project** key, not the admin key:
- If the key was just created/rotated in this session, it is used automatically.
- Otherwise the page shows a card "Enter this project's API key to manage its
  addresses" (key input, kept only for this page) with a hint: *lost it? Rotate API key*.

Table (`GET …/addresses`, 100 per page via `limit`/`offset`, "Next/Previous"
because there is no total):

| Column | Content |
|---|---|
| Address | Address chip with copy |
| State | Live / Syncing / Pending start pill |
| Start lt | mono, or "pending" |
| Last lt | mono, or "—" |
| Last error | red Error pill, message in tooltip (`lastError`) |
| Actions | **Unlink** (confirm: "Data stays in the indexer") |

Header button **+ Register addresses** → drawer form:
- Addresses textarea, one per line, 1–100, any form (`EQ…`, `UQ…`, `0:…`); duplicates
  and bad lines flagged before sending; a server error with `index` highlights that line.
- Start: radio **From now** (`"now"`) or **From lt** (decimal input; `0` = whole history).
- Result list per address: *new source* / *already indexed* · *linked* / *already linked* ·
  *history syncing*.

### 4.6 Settings
- API base URL in use, API status (`/health/ready`), link to OpenAPI `/docs`.
- Sign out.

---

## 5. Project Manager workspace (GraphQL)

**Sidebar** – project card at top (identicon, project name, `TON` network pill).
MENU: Dashboard · Addresses · Transactions. SUPPORT: Settings.

### 5.1 Dashboard
Data: `project` query, then one GraphQL request that aliases `transactions(limit: 10)`
for each address (`a0: transactions(address: …)`, `a1: …`), merged client-side.
Cap at the first 20 addresses for this request.
- **Row 1 – KPI cards:** Tracked addresses · Live · Syncing.
- **Row 2 – "Latest transactions"** table (10 newest across addresses, by `utime`
  then `lt`), columns as 5.3 minus Fee, with "View all →".
- No chart (see §9).

### 5.2 Addresses
From `project.addresses`; client-side search and pagination.

| Column | Content |
|---|---|
| Address | Address chip with copy |
| State | Live / Syncing / Pending start pill |
| Start lt | mono or "pending" |
| Last lt | mono or "—" |

Row click → Transactions for that address. Empty state: "No addresses yet — ask your
admin to register them."

### 5.3 Transactions
- **Address selector** at the top of the card (required by the API; defaults to the
  first address, or the one from the URL `?address=`).
- `limit: 20`, **Load more** passes the last row's `lt` as `beforeLt`; hide it when a
  page returns fewer than 20 rows.
- Search box filters loaded rows client-side by hash / sender / destination.

| Column | Content |
|---|---|
| Tx hash | Hash chip with copy |
| Time | Relative time (`time`) |
| From → Out | `sender` chip → first `outMsgs[].destination` chip (+N if more; "external" when `sender` is null) |
| Value | `value` in TON (incoming) |
| Fee | `fee` in TON |
| Opcode | `inMsgOpcode` mono, or "—" |
| Status | Success / Failed pill |

Row expand → lt, trace id, every out message (destination, value, opcode).

### 5.4 Settings
- Project info (read-only): name, project ID, network `TON`.
- Sign out. (No editable profile – there are no user accounts.)

---

## 6. States
- **Loading:** skeleton rows/cards in the content's shape.
- **Empty:** icon + message (no projects / no addresses / no transactions yet –
  "the indexer may still be syncing history").
- **Errors:** map codes from §1 to plain messages; never show raw server text for 500.

## 7. Responsive
Unchanged from plan §8 (desktop full sidebar, tablet icons + 2-col KPIs, mobile
drawer + stacked cards + horizontally scrolling tables).

## 8. Technical notes
- **CORS is not enabled** in ton-observer (`src/main.ts`). Run the dashboard behind
  the same origin: dev server proxy (`/projects`, `/graphql`, `/health` → API) and the
  same reverse proxy (traefik) in prod. Or add `app.enableCors` in the backend (§9).
- Suggested stack: Vite + React + TypeScript, TanStack Query, a tiny `fetch` GraphQL
  client (no Apollo needed), `@ton/core` for address formatting, Recharts for the one chart.
- The admin key lives in the browser: use the dashboard only on a trusted network.

---

## 9. Future (in the plan, not in the API yet)

| # | Plan feature | What's missing in ton-observer | Needed for |
|---|---|---|---|
| F1 | User login (email / password), roles, redirect by role | No users table or auth; only admin key + project keys | §5 Roles |
| F2 | Project Managers page, Invite, assign manager | No manager entity, no invite / email flow | Admin §6.4, Create project "Assign manager" |
| F3 | Project network | Single chain (TON via Toncenter); no field | Network pill / select |
| F4 | Project contract address on create | Addresses are registered separately; create takes only `name` | Create project |
| F5 | Project status Active / Paused, Pause action | No status column or endpoint | Projects table, actions |
| F6 | Edit / delete project | No `PATCH` / `DELETE /projects/:id` | Actions ⋮ |
| F7 | Transaction counts (per project, global), "Transactions (24h)" | No count / stats endpoint | Admin KPIs, Projects column, PM KPI |
| F8 | "Transactions per month" / "Daily transactions" charts | No aggregate endpoint (per day/month) | Charts |
| F9 | Unique wallets, success rate | No aggregates | PM KPIs |
| F10 | KPI change pills (↑ 11%) | No history to compare | KPI cards |
| F11 | Search transactions by hash or by any address | `transactions` needs one linked address; no hash lookup | Transactions search |
| F12 | One project-wide transaction feed with total + page numbers | Only per-address cursor paging, no totals | Transactions, Latest table |
| F13 | Tokens page (jettons: name, symbol, supply, holders) | Jetton sources are slice 5; no token data | PM Tokens |
| F14 | Accounts page: balance, tx count, last active | No balances (needs handlers) or per-address counts | PM Accounts |
| F15 | Admin access to a project's addresses without its key | Address routes accept only the project key | Admin §4.5 |
| F16 | Register / unlink addresses from the PM workspace via GraphQL | No mutations; only REST with project key | PM Addresses |
| F17 | `lastError`, `failingSince`, sync lag in GraphQL / a `status` endpoint | Only REST `lastError`; `status` endpoint is planned | PM Addresses health, Admin health |
| F18 | Server-side search, sort and paging for `GET /projects` | Returns all, sorted by name | Projects table at scale |
| F19 | Admin / manager profile settings (name, email, password) | No users (see F1) | Settings |
| F20 | Notifications | No event source | Top bar bell |
| F21 | CORS for a dashboard on another origin | Not enabled | Deployment |
