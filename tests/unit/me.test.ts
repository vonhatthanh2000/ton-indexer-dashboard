import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/client";
import type { Me } from "@/lib/types";
import { fetchMe, getMe } from "@/server/me";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: "__Host-session=abc; other=1" }),
}));

const ME: Me = {
  user: { id: "u1", email: "pm@acme.com", name: null, isAdmin: false, hasPassword: true },
  projects: [{ id: "p1", name: "Alpha", role: "owner" }],
};

function upstream(response: Response | Error) {
  const mock = response instanceof Error ? vi.fn().mockRejectedValue(response) : vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => vi.unstubAllGlobals());

describe("getMe", () => {
  it("calls GET {API}/auth/me with the incoming cookie and returns the body on 200", async () => {
    const fetchMock = upstream(Response.json(ME));
    await expect(getMe()).resolves.toEqual(ME);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:3999/auth/me");
    expect(init.headers.cookie).toBe("__Host-session=abc; other=1");
    expect(init.redirect).toBe("manual");
    expect(init.cache).toBe("no-store");
  });
  it("returns null on 401", async () => {
    upstream(Response.json({ error: "not_logged_in" }, { status: 401 }));
    await expect(fetchMe("__Host-session=old")).resolves.toBeNull();
  });
  it("throws login_disabled on 503 login_disabled, with the code in the digest", async () => {
    upstream(Response.json({ error: "login_disabled" }, { status: 503 }));
    const error = await fetchMe("x=1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503, code: "login_disabled", digest: "api_error:login_disabled" });
  });
  it("throws api_unreachable on a network error", async () => {
    upstream(new TypeError("fetch failed"));
    await expect(fetchMe(null)).rejects.toMatchObject({ status: 502, code: "api_unreachable" });
  });
  it("throws api_timeout on a timeout", async () => {
    upstream(new DOMException("timed out", "TimeoutError"));
    await expect(fetchMe(null)).rejects.toMatchObject({ status: 504, code: "api_timeout" });
  });
  it("throws internal_error on a 500 without a code", async () => {
    upstream(new Response("oops", { status: 500 }));
    await expect(fetchMe(null)).rejects.toMatchObject({ status: 500, code: "internal_error" });
  });
  it("sends no cookie header when there is none", async () => {
    const fetchMock = upstream(Response.json({ error: "not_logged_in" }, { status: 401 }));
    await fetchMe(null);
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ accept: "application/json" });
  });
});
