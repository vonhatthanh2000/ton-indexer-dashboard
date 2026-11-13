# Frontend integration: dashboard login, projects and members

## What changed
The API now has user accounts. People sign in to the dashboard with Google or email + password and get a session cookie; each user sees only the projects they belong to, with a role per project. Admins create projects for an owner's email; the owner generates the project's API key for other systems.

## How to use
Every dashboard call: `fetch(API + path, { credentials: 'include', ... })`. The browser sends the session cookie and the `Origin` header itself; JSON bodies need `content-type: application/json`. Full reference with every field: `GET {API}/docs` (Swagger).

**Sign in**
- Google: send the browser (a full-page navigation, not fetch) to `GET {API}/auth/google`. It comes back to `DASHBOARD_ORIGIN/` signed in, or to `DASHBOARD_ORIGIN/?login_error=<code>`.
- Password: `POST /auth/login` `{ "email": "pm@acme.com", "password": "a long enough password" }` → `204`, cookie set.
- `POST /auth/logout` → `204`, cookie cleared.
- `POST /auth/password` `{ "newPassword": "…" }` (first password, user signed in with Google) or `{ "currentPassword": "…", "newPassword": "…" }` → `204`; other sessions of that user end.

**Who am I** — call on app load:
`GET /auth/me` →
```json
{ "user": { "id": "uuid", "email": "pm@acme.com", "name": "Grace Owner", "isAdmin": false, "hasPassword": true },
  "projects": [{ "id": "uuid", "name": "Alpha", "role": "owner" }] }
```

**Projects** (path ids are the project `id` from `/auth/me`)
| Call | Who | Reply |
|---|---|---|
| `GET /projects/:id/addresses?limit=100&offset=0` | any role | `{ addresses: [{ address, sourceId, state, startLt, lastLt, stillSyncing, lastError }], limit, offset }` |
| `POST /projects/:id/addresses` `{ addresses: ["EQ…", …≤100], startLt: "now" \| "<lt>" }` | owner, editor | `200 { addresses: [{ address, sourceId, created, linked, stillSyncing }] }` |
| `DELETE /projects/:id/addresses/:address` | owner, editor | `204` |
| `POST /projects/:id/api-key` | owner | `200 { apiKey }` — show once; a new call replaces the old key |
| `GET /projects/:id/members` | any role | `{ members: [{ userId, email, name, role }] }` |
| `PUT /projects/:id/members` `{ email, role }` | owner | `200 { member: { userId, email, role }, invite: { sent } }` — adds or changes a role |
| `DELETE /projects/:id/members/:userId` | owner | `204` |
| `POST /projects/:id/members/:userId/invite` | owner, admin | `200 { invite: { sent } }` |

**Admin screens** (`user.isAdmin`)
| Call | Reply |
|---|---|
| `POST /projects` `{ name, ownerEmail }` | `201 { project: { id, name, createdAt }, owner: { userId, email }, invite: { sent } }` (no key) |
| `GET /projects` | `{ projects: [{ id, name, createdAt, owners: [{ userId, email }], activeAccounts, hasApiKey }] }` |
| `POST /projects/:id/owners` `{ email }` | `200 { member, invite }` — gives a project a new owner |
| `POST /users` `{ email, isAdmin: true }` | `201`/`200 { user: { id, email, isAdmin } }` |

**GraphQL** `POST /graphql` with the cookie: `project(id: "<projectId>") { id name addresses { address state startLt lastLt stillSyncing } }` and `transactions(address, limit, beforeLt)`.

## Types and data formats
- `role`: `owner` | `editor` (read + write addresses) | `viewer` (read only). In `/auth/me`, an admin sees `admin` on projects they are not a member of.
- Addresses: send any TON form; replies are raw uppercase `0:HEX…`.
- `lt`, `startLt`, `lastLt`, `sourceId`: decimal **strings** — never parse to `Number`. `startLt` and `lastLt` may be `null` (`null` startLt = "now", not resolved yet).
- `stillSyncing`: `true` until history from the project's start is indexed.
- `invite.sent: false` means the email was not sent (not configured or provider error); the action itself succeeded — offer "resend".
- Emails are trimmed and lower-cased by the API.

## Errors
Body is always `{ "error": "<code>" }`; validation adds `field`, `problem` (and `index` for address lists).
| Code | Status | Do |
|---|---|---|
| `not_logged_in` | 401 | Show the sign-in page |
| `invalid_credentials` | 401 | "Wrong email or password" |
| `invalid_request` | 400 | Show `problem` next to `field` |
| `insufficient_role` / `owner_only` / `admin_only` | 403 | Hide or disable the action for this role |
| `bad_origin` | 403 | Request not from `DASHBOARD_ORIGIN` — a config problem, not the user's |
| `project_not_found` | 404 | Project gone or not yours — drop it, refetch `/auth/me` |
| `member_not_found`, `address_not_linked` | 404 | Refresh the list |
| `last_owner` | 409 | "Add another owner first" |
| `project_exists` | 409 | "Name taken" |
| `login_disabled`, `google_login_disabled` | 503 | Login not configured on this server |

`login_error` on return from Google: `google_cancelled` (user backed out), `not_invited` (no account for that email — ask an admin), `google_account_mismatch` (email tied to another Google account), `bad_state` / `google_failed` (retry).

## Flow
1. On load, `GET /auth/me`; 401 → sign-in page (Google button = link to `/auth/google`, or email + password form).
2. Show `projects` from `/auth/me`; actions follow `role`.
3. Owner: `POST /projects/:id/api-key`, show the key once with a copy button and "store it now".
4. Owner/editor: register addresses; poll `GET …/addresses` to watch `stillSyncing` turn `false`.
5. Owner: manage members (`PUT`/`DELETE …/members`).

## Gotchas
- `credentials: 'include'` on every fetch; without it there is no session.
- The dashboard must be served from exactly `DASHBOARD_ORIGIN` (scheme, host, port; same site as the API). Other origins get CORS errors or `403 bad_origin`.
- Never send `X-API-Key` from the dashboard: a key header overrides the session.
- Sessions last 8 hours and are not renewed; a password change logs out the user's other browsers. Handle 401 anywhere by returning to sign-in.
- The project key is shown once and not stored in readable form; there is no "show key" call.
- Locally the cookie is `Secure`: use Chrome or Firefox on `http://localhost`.

## Quick test
In the dashboard's browser console (signed in):
```js
await fetch(`${API}/auth/me`, { credentials: 'include' }).then((r) => r.json())
```
Signed out, the same call returns `401 { "error": "not_logged_in" }`.
