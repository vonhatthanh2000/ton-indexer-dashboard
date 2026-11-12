// A fake ton-observer for e2e tests: the REST, GraphQL and health paths the dashboard proxy calls.
// Control: POST /__reset, POST /__scenario {..}, GET /__calls, DELETE /__calls, GET /__state.
import { createHash } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_OBSERVER_PORT ?? 3999);
export const ADMIN_KEY = "test-admin-key";
export const ALPHA_ID = "11111111-1111-4111-8111-111111111111";
export const ALPHA_KEY = "alphaKey_0123456789-ABCDEFGHIJKLMNOPQRSTUVW"; // 43 chars
export const EMPTY_ID = "22222222-2222-4222-8222-222222222222";
export const EMPTY_KEY = "emptyKey_0123456789-ABCDEFGHIJKLMNOPQRSTUVW";
const USDT = "0:B113A994B5024A16719F69139328EB759596C38A25F59028B146FECDC3621DFE";
const ZERO = `0:${"0".repeat(64)}`;
const PENDING = `0:${"AB".repeat(32)}`;

let state;
let scenario;
let calls = [];
let keyCounter = 0;

function hashOf(seed) {
  return createHash("sha256").update(seed).digest("base64");
}

function makeTransactions(account, count) {
  const rows = [];
  const baseLt = 47_000_000_000_000n;
  const baseTime = 1_794_400_000; // 2026-11-12 area
  for (let index = 0; index < count; index += 1) {
    const lt = (baseLt - BigInt(index) * 1_000n + BigInt(account.length)).toString();
    const utime = String(baseTime - index * 600 - (account === ZERO ? 300 : 0));
    rows.push({
      hash: hashOf(`${account}-${index}`),
      lt,
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

function address(addressValue, overrides = {}) {
  return { address: addressValue, sourceId: String(Math.abs(hashOf(addressValue).charCodeAt(0))), state: "live", startLt: "0", lastLt: "47000000000123", stillSyncing: false, lastError: null, ...overrides };
}

function reset() {
  keyCounter = 0;
  calls = [];
  scenario = { health: "ok", registerError: null, unlinkNotLinked: false, forbiddenFeedOnce: false };
  state = {
    projects: [
      { id: ALPHA_ID, name: "alpha", createdAt: "2026-09-03T10:00:00.000Z", apiKey: ALPHA_KEY, addresses: [address(USDT), address(ZERO, { state: "resyncing", stillSyncing: true, lastError: "ToncenterError status 429" }), address(PENDING, { startLt: null, lastLt: null, stillSyncing: true })] },
      { id: EMPTY_ID, name: "empty-project", createdAt: "2026-11-01T08:00:00.000Z", apiKey: EMPTY_KEY, addresses: [] },
      { id: "33333333-3333-4333-8333-333333333333", name: "gamma", createdAt: "2026-07-20T08:00:00.000Z", apiKey: null, addresses: [address(USDT)] },
    ],
    transactions: { [USDT]: makeTransactions(USDT, 45), [ZERO]: makeTransactions(ZERO, 7), [PENDING]: [] },
  };
}
reset();

function newKey() {
  keyCounter += 1;
  return `issued${String(keyCounter).padStart(2, "0")}_${"x".repeat(35)}`.slice(0, 43);
}

function send(res, status, body) {
  if (body === undefined) {
    res.writeHead(status);
    res.end();
    return;
  }
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return Symbol.for("bad-json");
  }
}

function view(project) {
  return { id: project.id, name: project.name, createdAt: project.createdAt };
}

function projectByKey(key) {
  return state.projects.find((project) => project.apiKey && project.apiKey === key);
}

function isAddress(value) {
  return typeof value === "string" && /^(0|-1):[0-9A-Fa-f]{64}$|^[EU]Q[A-Za-z0-9_-]{46}$/.test(value);
}

function gqlError(res, code, message) {
  send(res, 200, { data: null, errors: [{ message, extensions: { code } }] });
}

function handleGraphql(req, res, body) {
  const project = projectByKey(req.headers["x-api-key"]);
  if (!project) return gqlError(res, "UNAUTHENTICATED", "X-API-Key: is not a valid project key");
  const query = String(body?.query ?? "");
  const variables = body?.variables ?? {};
  if (/project\s*\{/.test(query)) {
    return send(res, 200, { data: { project: { id: project.id, name: project.name, addresses: project.addresses.map(({ address: a, state: s, startLt, lastLt, stillSyncing }) => ({ address: a, state: s, startLt, lastLt, stillSyncing })) } } });
  }
  const linked = new Set(project.addresses.map((row) => row.address));
  if (/DashboardFeed/.test(query)) {
    if (scenario.forbiddenFeedOnce) {
      scenario.forbiddenFeedOnce = false;
      return gqlError(res, "FORBIDDEN", "address: is not linked to this project");
    }
    const data = {};
    for (const [alias, value] of Object.entries(variables)) {
      if (!linked.has(value)) return gqlError(res, "FORBIDDEN", "address: is not linked to this project");
      data[alias] = (state.transactions[value] ?? []).slice(0, 10);
    }
    return send(res, 200, { data });
  }
  if (/transactions\s*\(/.test(query)) {
    const target = variables.address;
    if (!linked.has(target)) return gqlError(res, "FORBIDDEN", "address: is not linked to this project");
    const limit = Number(variables.limit ?? 20);
    const before = variables.beforeLt ? BigInt(variables.beforeLt) : null;
    const rows = (state.transactions[target] ?? []).filter((row) => before === null || BigInt(row.lt) < before).slice(0, limit);
    return send(res, 200, { data: { transactions: rows } });
  }
  return send(res, 400, { errors: [{ message: "Unknown query", extensions: { code: "GRAPHQL_VALIDATION_FAILED" } }] });
}

async function handle(req, res) {
  const url = new URL(req.url, "http://fake");
  const path = url.pathname;

  // control endpoints (not recorded)
  if (path === "/__reset") return reset(), send(res, 204);
  if (path === "/__scenario") return Object.assign(scenario, await readBody(req)), send(res, 204);
  if (path === "/__calls") {
    if (req.method === "DELETE") return (calls = []), send(res, 204);
    return send(res, 200, calls);
  }
  if (path === "/__state") return send(res, 200, { ...state, scenario });

  const body = req.method === "GET" || req.method === "DELETE" ? undefined : await readBody(req);
  calls.push({ method: req.method, path, search: url.search, adminKey: Boolean(req.headers["x-admin-key"]), apiKey: Boolean(req.headers["x-api-key"]), body: body === Symbol.for("bad-json") ? "<bad json>" : body });

  if (path === "/health/ready") {
    if (scenario.health === "down") return req.socket.destroy();
    if (scenario.health === "db_down") return send(res, 503, { status: "error", db: "down" });
    return send(res, 200, { status: "ok", db: "up" });
  }
  if (path === "/graphql" && req.method === "POST") return handleGraphql(req, res, body);

  const adminOk = () => {
    const given = req.headers["x-admin-key"];
    if (!given) return send(res, 401, { error: "missing_admin_key" }), false;
    if (given !== ADMIN_KEY) return send(res, 401, { error: "invalid_admin_key" }), false;
    return true;
  };

  if (path === "/projects") {
    if (!adminOk()) return;
    if (req.method === "GET") {
      const projects = [...state.projects].sort((a, b) => a.name.localeCompare(b.name)).map((project) => ({ ...view(project), activeAccounts: project.addresses.length }));
      return send(res, 200, { projects });
    }
    if (req.method === "POST") {
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      if (!name) return send(res, 400, { error: "invalid_request", field: "name", problem: "is required" });
      if (state.projects.some((project) => project.name === name)) return send(res, 409, { error: "project_exists" });
      const project = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), apiKey: newKey(), addresses: [] };
      state.projects.push(project);
      return send(res, 201, { project: view(project), apiKey: project.apiKey });
    }
  }

  const keyMatch = path.match(/^\/projects\/([^/]+)\/api-key$/);
  if (keyMatch && req.method === "POST") {
    if (!adminOk()) return;
    const project = state.projects.find((row) => row.id === keyMatch[1]);
    if (!project) return send(res, 404, { error: "project_not_found" });
    project.apiKey = newKey();
    return send(res, 200, { project: view(project), apiKey: project.apiKey });
  }

  const addrMatch = path.match(/^\/projects\/([^/]+)\/addresses(?:\/([^/]+))?$/);
  if (addrMatch) {
    const project = state.projects.find((row) => row.id === addrMatch[1]);
    const given = req.headers["x-api-key"];
    if (!given) return send(res, 401, { error: "missing_api_key" });
    if (!project || project.apiKey !== given) return send(res, 401, { error: "invalid_api_key" });
    if (req.method === "GET" && !addrMatch[2]) {
      const limit = Number(url.searchParams.get("limit") ?? 100);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      return send(res, 200, { addresses: project.addresses.slice(offset, offset + limit), limit, offset });
    }
    if (req.method === "POST" && !addrMatch[2]) {
      if (scenario.registerError) return send(res, 400, scenario.registerError);
      const list = Array.isArray(body?.addresses) ? body.addresses : [];
      const result = list.map((value) => {
        const existing = project.addresses.find((row) => row.address === value);
        const known = state.projects.some((row) => row.addresses.some((a) => a.address === value));
        if (!existing) project.addresses.push(address(value, { startLt: body.startLt === "now" ? null : body.startLt, lastLt: null, stillSyncing: true }));
        return { address: value, sourceId: "9", created: !known, linked: !existing, stillSyncing: true };
      });
      return send(res, 200, { addresses: result });
    }
    if (req.method === "DELETE" && addrMatch[2]) {
      const target = decodeURIComponent(addrMatch[2]);
      if (!isAddress(target)) return send(res, 400, { error: "invalid_address" });
      const index = project.addresses.findIndex((row) => row.address === target);
      if (scenario.unlinkNotLinked || index === -1) return send(res, 404, { error: "address_not_linked" });
      project.addresses.splice(index, 1);
      return send(res, 204);
    }
  }
  return send(res, 404, { error: "not_found" });
}

createServer((req, res) => {
  handle(req, res).catch(() => send(res, 500, { error: "internal_error" }));
}).listen(PORT, "127.0.0.1", () => console.log(`fake ton-observer on ${PORT}`));
