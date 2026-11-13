import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "@/app/api/[...path]/route";
import * as auth from "@/app/auth/[...path]/route";
import { GET as health } from "@/app/api/health/route";

const BASE = "http://localhost:3100";
const API = "http://127.0.0.1:3999"; // tests/unit/setup.ts

function request(path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  return new NextRequest(`${BASE}${path}`, init);
}

function upstream(response: Response | Error) {
  const mock = response instanceof Error ? vi.fn().mockRejectedValue(response) : vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", mock);
  return mock;
}

function sent(mock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit & { headers: Headers } } {
  const [url, init] = mock.mock.calls[0];
  return { url, init };
}

afterEach(() => vi.unstubAllGlobals());

describe("request headers", () => {
  it("sends Cookie, Origin, Content-Type and Accept on; drops X-API-Key, X-Admin-Key, Host and X-Forwarded-*", async () => {
    const mock = upstream(Response.json({ ok: true }));
    await api.POST(
      request("/api/projects/p1/addresses", {
        method: "POST",
        headers: {
          cookie: "__Host-session=s1",
          origin: "http://localhost:3100",
          "content-type": "application/json",
          accept: "application/json",
          "x-api-key": "k",
          "x-admin-key": "a",
          host: "evil.example",
          "x-forwarded-for": "1.2.3.4",
          "x-forwarded-host": "evil.example",
          authorization: "Bearer t",
        },
        body: '{"addresses":[]}',
      }),
    );
    const { url, init } = sent(mock);
    expect(url).toBe(`${API}/projects/p1/addresses`);
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    expect(init.cache).toBe("no-store");
    expect([...init.headers.keys()].sort()).toEqual(["accept", "content-type", "cookie", "origin"]);
    expect(init.headers.get("cookie")).toBe("__Host-session=s1");
    expect(init.headers.get("origin")).toBe("http://localhost:3100");
    expect(new TextDecoder().decode(init.body as Uint8Array)).toBe('{"addresses":[]}');
  });
  it("sends no body on GET", async () => {
    const mock = upstream(Response.json({ projects: [] }));
    await api.GET(request("/api/projects"));
    expect(sent(mock).init.body).toBeUndefined();
  });
});

describe("replies", () => {
  it("passes a 302 through with its Location and both Set-Cookie headers", async () => {
    const headers = new Headers({ location: "https://accounts.google.com/o/oauth2/v2/auth?x=1" });
    headers.append("set-cookie", "google_state=abc; Path=/auth/google; HttpOnly; Secure; SameSite=Lax");
    headers.append("set-cookie", "google_verifier=def; Path=/auth/google; HttpOnly; Secure; SameSite=Lax");
    upstream(new Response(null, { status: 302, headers }));
    const reply = await auth.GET(request("/auth/google"));
    expect(reply.status).toBe(302);
    expect(reply.headers.get("location")).toBe("https://accounts.google.com/o/oauth2/v2/auth?x=1");
    expect(reply.headers.getSetCookie()).toEqual([
      "google_state=abc; Path=/auth/google; HttpOnly; Secure; SameSite=Lax",
      "google_verifier=def; Path=/auth/google; HttpOnly; Secure; SameSite=Lax",
    ]);
    expect(reply.headers.get("cache-control")).toBe("no-store");
  });
  it("passes a 204 with Set-Cookie through, with a null body", async () => {
    const cookie = "__Host-session=s2; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800";
    upstream(new Response(null, { status: 204, headers: { "set-cookie": cookie } }));
    const reply = await auth.POST(
      request("/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
    );
    expect(reply.status).toBe(204);
    expect(reply.headers.getSetCookie()).toEqual([cookie]);
    expect(reply.body).toBeNull();
  });
  it("forwards PATCH (admin rename) with its body; /auth/* has no PATCH", async () => {
    const mock = upstream(Response.json({ project: { id: "p1", name: "New" } }));
    const reply = await api.PATCH(
      request("/api/projects/p1", { method: "PATCH", headers: { "content-type": "application/json", origin: BASE }, body: '{"name":"New"}' }),
    );
    expect(reply.status).toBe(200);
    const { url, init } = sent(mock);
    expect(url).toBe(`${API}/projects/p1`);
    expect(init.method).toBe("PATCH");
    expect(new TextDecoder().decode(init.body as ArrayBuffer | Uint8Array)).toBe('{"name":"New"}');
    expect("PATCH" in auth).toBe(false);
  });
  it("passes status, body and content-type through", async () => {
    upstream(Response.json({ error: "insufficient_role" }, { status: 403 }));
    const reply = await api.DELETE(request("/api/projects/p1/members/u1", { method: "DELETE" }));
    expect(reply.status).toBe(403);
    expect(reply.headers.get("content-type")).toContain("application/json");
    expect(reply.headers.get("cache-control")).toBe("no-store");
    expect(await reply.json()).toEqual({ error: "insufficient_role" });
  });
  it("forwards /auth/* sub-paths unchanged, with the query", async () => {
    const mock = upstream(new Response(null, { status: 302, headers: { location: "/" } }));
    await auth.GET(request("/auth/google/callback?code=c&state=s"));
    expect(sent(mock).url).toBe(`${API}/auth/google/callback?code=c&state=s`);
  });
});

describe("limits and failures", () => {
  it("answers 413 payload_too_large for a 70 KiB body without calling upstream", async () => {
    const mock = upstream(Response.json({}));
    const reply = await api.POST(request("/api/projects/p1/addresses", { method: "POST", body: "a".repeat(70 * 1024) }));
    expect(reply.status).toBe(413);
    expect(await reply.json()).toEqual({ error: "payload_too_large" });
    expect(mock).not.toHaveBeenCalled();
  });
  it("maps an upstream timeout to 504 api_timeout", async () => {
    upstream(new DOMException("timed out", "TimeoutError"));
    const reply = await api.GET(request("/api/projects"));
    expect(reply.status).toBe(504);
    expect(await reply.json()).toEqual({ error: "api_timeout" });
  });
  it("maps a refused connection to 502 api_unreachable", async () => {
    upstream(Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }));
    const reply = await api.GET(request("/api/projects"));
    expect(reply.status).toBe(502);
    expect(await reply.json()).toEqual({ error: "api_unreachable" });
  });
});

describe("/api paths", () => {
  it.each(["/api/foo", "/api/health/ready", "/api/auth/me", "/api/projectsx", "/api/graphql/x", "/api/users/u1"])(
    "%s → 404 not_found without calling upstream",
    async (path) => {
      const mock = upstream(Response.json({}));
      const reply = await api.GET(request(path));
      expect(reply.status).toBe(404);
      expect(await reply.json()).toEqual({ error: "not_found" });
      expect(mock).not.toHaveBeenCalled();
    },
  );
  it.each([
    ["/api/graphql", "/graphql"],
    ["/api/users", "/users"],
    ["/api/projects", "/projects"],
    ["/api/projects/x/addresses?limit=100&offset=0", "/projects/x/addresses?limit=100&offset=0"],
    ["/api/projects/x/addresses/EQ%2Fab", "/projects/x/addresses/EQ%2Fab"],
    ["/api/projects/x/addresses/0%3AABC%2B1", "/projects/x/addresses/0%3AABC%2B1"],
  ])("%s → upstream %s", async (path, expected) => {
    const mock = upstream(Response.json({}));
    await api.GET(request(path));
    expect(sent(mock).url).toBe(`${API}${expected}`);
  });
  it("/api/health maps to /health/ready", async () => {
    const mock = upstream(Response.json({ status: "ok" }));
    const reply = await health(request("/api/health"));
    expect(sent(mock).url).toBe(`${API}/health/ready`);
    expect(reply.status).toBe(200);
  });
});
