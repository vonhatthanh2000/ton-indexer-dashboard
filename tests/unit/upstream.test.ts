import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_BODY_BYTES,
  ProxyError,
  callUpstream,
  isValidAdminKey,
  isValidProjectKey,
  readJsonBody,
  route,
} from "@/server/upstream";
import { POST as login } from "@/app/api/auth/login/route";
import { sealSession, SESSION_COOKIE } from "@/server/session";

const BASE = "http://127.0.0.1:3100";
const PROJECT_KEY = "A".repeat(43);

function request(path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  return new NextRequest(`${BASE}${path}`, init);
}

afterEach(() => vi.unstubAllGlobals());

describe("key formats", () => {
  it("accepts only 43-char base64url project keys", () => {
    expect(isValidProjectKey(PROJECT_KEY)).toBe(true);
    expect(isValidProjectKey(`${PROJECT_KEY}A`)).toBe(false);
    expect(isValidProjectKey("A".repeat(42) + "+")).toBe(false);
  });
  it("accepts printable ASCII admin keys up to 256", () => {
    expect(isValidAdminKey("a b~c")).toBe(true);
    expect(isValidAdminKey("bad\nkey")).toBe(false);
    expect(isValidAdminKey("ключ")).toBe(false);
    expect(isValidAdminKey("x".repeat(257))).toBe(false);
  });
});

describe("readJsonBody", () => {
  it("rejects a body over 64 KB even without Content-Length", async () => {
    const big = JSON.stringify({ x: "a".repeat(MAX_BODY_BYTES) });
    await expect(readJsonBody(request("/api/x", { method: "POST", body: big }))).rejects.toMatchObject({
      status: 413,
      code: "payload_too_large",
    });
  });
  it("rejects invalid JSON", async () => {
    await expect(readJsonBody(request("/api/x", { method: "POST", body: "{" }))).rejects.toBeInstanceOf(
      ProxyError,
    );
  });
});

describe("callUpstream", () => {
  it("maps a refused connection to 502 api_unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(callUpstream("GET", "/projects", {})).rejects.toMatchObject({ status: 502, code: "api_unreachable" });
  });
  it("maps a timeout to 504 api_timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("t", "TimeoutError")));
    await expect(callUpstream("GET", "/projects", {})).rejects.toMatchObject({ status: 504, code: "api_timeout" });
  });
  it("maps a non-JSON body to 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })));
    await expect(callUpstream("GET", "/projects", {})).rejects.toMatchObject({ status: 502 });
  });
  it("accepts an empty 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(callUpstream("DELETE", "/x", {})).resolves.toEqual({ status: 204, body: undefined });
  });
});

describe("route wrapper", () => {
  const handler = route({ role: "admin" }, async () => new (await import("next/server")).NextResponse("ok"));

  it("blocks a POST without the CSRF header", async () => {
    const reply = await handler(request("/api/admin/projects", { method: "POST", body: "{}" }), {});
    expect(reply.status).toBe(403);
    expect(await reply.json()).toEqual({ error: "csrf" });
  });
  it("answers 401 session_expired without a session", async () => {
    const reply = await handler(request("/api/admin/projects"), {});
    expect(reply.status).toBe(401);
    expect(await reply.json()).toEqual({ error: "session_expired" });
  });
  it("answers 403 wrong_role for a project session", async () => {
    const sealed = await sealSession({ role: "project", key: PROJECT_KEY, issuedAt: Date.now() });
    const reply = await handler(request("/api/admin/projects", { headers: { cookie: `${SESSION_COOKIE}=${sealed}` } }), {});
    expect(reply.status).toBe(403);
  });
  it("sets no-store on replies", async () => {
    const reply = await handler(request("/api/admin/projects"), {});
    expect(reply.headers.get("cache-control")).toBe("no-store");
  });
});

describe("login", () => {
  it("rejects a malformed key without calling upstream", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const reply = await login(
      request("/api/auth/login", {
        method: "POST",
        headers: { "x-requested-with": "dashboard" },
        body: JSON.stringify({ role: "project", key: "short\nkey" }),
      }),
      {},
    );
    expect(reply.status).toBe(401);
    expect(await reply.json()).toEqual({ error: "invalid_key" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reply.headers.get("set-cookie") ?? "").not.toContain(`${SESSION_COOKIE}=Fe26`);
  });
  it("sets a strict httpOnly session cookie without Max-Age on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ data: { project: { id: "p1", name: "demo" } } })),
    );
    const reply = await login(
      request("/api/auth/login", {
        method: "POST",
        headers: { "x-requested-with": "dashboard" },
        body: JSON.stringify({ role: "project", key: PROJECT_KEY }),
      }),
      {},
    );
    expect(reply.status).toBe(200);
    expect(await reply.json()).toEqual({ role: "project", projectId: "p1", projectName: "demo" });
    const cookies = reply.headers.getSetCookie();
    const session = cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))!;
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/SameSite=strict/i);
    expect(session).not.toMatch(/Max-Age|Expires/i);
    expect(cookies.some((cookie) => cookie.startsWith("tonobs_pkeys=;"))).toBe(true);
  });
});
