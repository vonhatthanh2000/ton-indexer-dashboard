// A minimal fake ton-observer for the visual e2e gate: only the read paths the pages call.
// The signed-in user is the `__Host-session` cookie value: admin, owner, editor, viewer or none.
import { createHash } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_OBSERVER_PORT ?? 3999);
export const ALPHA_ID = "11111111-1111-4111-8111-111111111111";
export const GAMMA_ID = "33333333-3333-4333-8333-333333333333";
const USDT = "0:B113A994B5024A16719F69139328EB759596C38A25F59028B146FECDC3621DFE";
const ZERO = `0:${"0".repeat(64)}`;
const PENDING = `0:${"AB".repeat(32)}`;

const USERS = {
  admin: { id: "u-admin", email: "admin@example.com", name: "Morgan Admin", isAdmin: true, hasPassword: true },
  owner: { id: "u-owner", email: "owner@example.com", name: "Ada Lovelace", isAdmin: false, hasPassword: true },
  editor: { id: "u-editor", email: "editor@example.com", name: null, isAdmin: false, hasPassword: false },
  viewer: { id: "u-viewer", email: "viewer@example.com", name: "Vera Viewer", isAdmin: false, hasPassword: true },
  none: { id: "u-none", email: "newcomer@example.com", name: null, isAdmin: false, hasPassword: false },
};

function hashOf(seed) {
  return createHash("sha256").update(seed).digest("base64");
}

function makeTransactions(account, count) {
  const rows = [];
  const baseLt = 47_000_000_000_000n;
  const baseTime = 1_794_400_000;
  for (let index = 0; index < count; index += 1) {
    const utime = String(baseTime - index * 600 - (account === ZERO ? 300 : 0));
    rows.push({
      hash: hashOf(`${account}-${index}`),
      lt: (baseLt - BigInt(index) * 1_000n + BigInt(account.length)).toString(),
      utime,
      time: new Date(Number(utime) * 1000).toISOString(),
      traceId: hashOf(`trace-${account}-${index}`),
      inMsgOpcode: index % 3 === 0 ? "0x0f8a7ea5" : null,
      sender: index % 4 === 0 ? null : ZERO,
      value: index % 4 === 0 ? null : String(1_500_000_000 + index),
      aborted: index % 5 === 4,
      fee: String(3_100_000 + index),
      outMsgs: index % 2 === 0 ? [{ destination: USDT, value: "1000000000", opcode: "0x7362d09c" }, { destination: PENDING, value: null, opcode: null }] : [],
    });
  }
  return rows;
}

// stillSyncing is false everywhere so the addresses page doesn't poll during screenshots.
function address(value, overrides = {}) {
  return { address: value, sourceId: "7", state: "live", startLt: "0", lastLt: "47000000000123", stillSyncing: false, lastError: null, ...overrides };
}

const PROJECTS = [
  {
    id: ALPHA_ID,
    name: "alpha",
    createdAt: "2026-09-03T10:00:00.000Z",
    hasApiKey: true,
    addresses: [address(USDT), address(ZERO, { state: "resyncing", lastError: "ToncenterError status 429" }), address(PENDING, { startLt: null, lastLt: null })],
    members: [
      { userId: "u-owner", role: "owner" },
      { userId: "u-editor", role: "editor" },
      { userId: "u-viewer", role: "viewer" },
    ],
  },
  { id: "22222222-2222-4222-8222-222222222222", name: "empty-project", createdAt: "2026-11-01T08:00:00.000Z", hasApiKey: false, addresses: [], members: [] },
  { id: GAMMA_ID, name: "gamma", createdAt: "2026-07-20T08:00:00.000Z", hasApiKey: false, addresses: [address(USDT)], members: [{ userId: "u-owner", role: "viewer" }] },
];
const TRANSACTIONS = { [USDT]: makeTransactions(USDT, 45), [ZERO]: makeTransactions(ZERO, 7), [PENDING]: [] };

function userById(id) {
  return Object.values(USERS).find((user) => user.id === id);
}

/** The caller's role on a project: the membership, else `admin` for admins, else null. */
function roleOn(user, project) {
  const member = project.members.find((row) => row.userId === user.id);
  if (member) return member.role;
  return user.isAdmin ? "admin" : null;
}

function caller(req) {
  const cookie = req.headers.cookie ?? "";
  const value = /(?:^|;\s*)__Host-session=([^;]*)/.exec(cookie)?.[1];
  return value ? (USERS[value] ?? null) : null;
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function gqlError(res, code, message) {
  send(res, 200, { data: null, errors: [{ message, extensions: { code } }] });
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return {};
  }
}

function handleGraphql(res, user, body) {
  if (!user) return gqlError(res, "UNAUTHENTICATED", "not logged in");
  const query = String(body.query ?? "");
  const variables = body.variables ?? {};
  const readable = PROJECTS.filter((project) => roleOn(user, project) !== null);
  if (/project\s*\(/.test(query)) {
    const project = readable.find((row) => row.id === variables.id);
    if (!project) return gqlError(res, "FORBIDDEN", "id: is not a project you can read");
    const addresses = project.addresses.map(({ address: a, state, startLt, lastLt, stillSyncing }) => ({ address: a, state, startLt, lastLt, stillSyncing }));
    return send(res, 200, { data: { project: { id: project.id, name: project.name, addresses } } });
  }
  const linked = new Set(readable.flatMap((project) => project.addresses.map((row) => row.address)));
  const withAccount = (account) => (TRANSACTIONS[account] ?? []).map((row) => ({ ...row, account }));
  if (/projectTransactions\s*\(/.test(query)) {
    // Every address of the project, newest first by (utime, lt, account); `before` is the last row.
    const project = readable.find((row) => row.id === variables.id);
    if (!project) return gqlError(res, "FORBIDDEN", "id: is not a project you can read");
    const limit = Number(variables.limit ?? 20);
    const key = (row) => [BigInt(row.utime), BigInt(row.lt), row.account];
    const older = (a, b) => (a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2]);
    const before = variables.before ? key(variables.before) : null;
    const rows = project.addresses
      .flatMap((row) => withAccount(row.address))
      .filter((row) => before === null || older(key(row), before))
      .sort((a, b) => (older(key(a), key(b)) ? 1 : -1))
      .slice(0, limit);
    return send(res, 200, { data: { projectTransactions: rows } });
  }
  if (/transactions\s*\(/.test(query)) {
    const address = variables.address;
    if (!linked.has(address)) return gqlError(res, "FORBIDDEN", "address: is not linked to your projects");
    const limit = Number(variables.limit ?? 20);
    const before = variables.beforeLt ? BigInt(variables.beforeLt) : null;
    const rows = withAccount(address).filter((row) => before === null || BigInt(row.lt) < before).slice(0, limit);
    return send(res, 200, { data: { transactions: rows } });
  }
  return send(res, 400, { errors: [{ message: "Unknown query", extensions: { code: "GRAPHQL_VALIDATION_FAILED" } }] });
}

async function handle(req, res) {
  const url = new URL(req.url, "http://fake");
  const path = url.pathname;
  if (path === "/health/ready") return send(res, 200, { status: "ok", db: "up" });

  const user = caller(req);
  if (path === "/graphql" && req.method === "POST") return handleGraphql(res, user, await readJson(req));
  if (req.method !== "GET") return send(res, 404, { error: "not_found" });
  if (!user) return send(res, 401, { error: "not_logged_in" });

  if (path === "/auth/me") {
    const projects = PROJECTS.map((project) => ({ id: project.id, name: project.name, role: roleOn(user, project) })).filter((row) => row.role !== null);
    return send(res, 200, { user, projects });
  }
  if (path === "/projects") {
    if (!user.isAdmin) return send(res, 403, { error: "admin_only" });
    const projects = PROJECTS.map((project) => ({
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      owners: project.members.filter((row) => row.role === "owner").map((row) => ({ userId: row.userId, email: userById(row.userId).email })),
      activeAccounts: project.addresses.length,
      hasApiKey: project.hasApiKey,
    }));
    return send(res, 200, { projects });
  }
  const match = /^\/projects\/([^/]+)\/(addresses|members)$/.exec(path);
  if (match) {
    const project = PROJECTS.find((row) => row.id === match[1]);
    if (!project || roleOn(user, project) === null) return send(res, 404, { error: "project_not_found" });
    if (match[2] === "members") {
      const members = project.members.map((row) => {
        const member = userById(row.userId);
        return { userId: member.id, email: member.email, name: member.name, role: row.role };
      });
      return send(res, 200, { members });
    }
    const limit = Number(url.searchParams.get("limit") ?? 100);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    return send(res, 200, { addresses: project.addresses.slice(offset, offset + limit), limit, offset });
  }
  return send(res, 404, { error: "not_found" });
}

createServer((req, res) => {
  handle(req, res).catch(() => send(res, 500, { error: "internal_error" }));
}).listen(PORT, "127.0.0.1", () => console.log(`fake ton-observer on ${PORT}`));
