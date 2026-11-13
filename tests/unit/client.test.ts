import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, GqlError, apiFetch, configureClient, gql, loginUrlForExpiry, resetClient } from "@/lib/client";

const navigate = vi.fn();
const push = vi.fn();
const invalidateMe = vi.fn();

function reply(status: number, body?: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(body === undefined ? new Response(null, { status }) : Response.json(body, { status })));
}

function gqlErrors(code: string, message: string) {
  reply(200, { data: null, errors: [{ message, extensions: { code } }] });
}

beforeEach(() => {
  vi.stubGlobal("window", { location: { pathname: "/projects/p1/addresses", search: "?offset=100" } });
  configureClient({ navigate, push, invalidateMe });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  resetClient();
});

const EXPIRED = "/login?reason=expired&next=%2Fprojects%2Fp1%2Faddresses%3Foffset%3D100";

describe("loginUrlForExpiry", () => {
  it("adds next only for workspace paths", () => {
    expect(loginUrlForExpiry("/admin/users")).toBe("/login?reason=expired&next=%2Fadmin%2Fusers");
    expect(loginUrlForExpiry("/login")).toBe("/login?reason=expired");
    expect(loginUrlForExpiry()).toBe(EXPIRED);
  });
});

describe("apiFetch", () => {
  it("sends same-origin, no-store, with only Accept and Content-Type", async () => {
    reply(200, { ok: true });
    await expect(apiFetch("/api/projects/p1/members", { method: "PUT", body: { email: "a@b.c", role: "viewer" } })).resolves.toEqual({ ok: true });
    const [path, init] = vi.mocked(fetch).mock.calls[0];
    expect(path).toBe("/api/projects/p1/members");
    expect(init).toMatchObject({ method: "PUT", credentials: "same-origin", cache: "no-store", body: '{"email":"a@b.c","role":"viewer"}' });
    expect(init?.headers).toEqual({ Accept: "application/json", "Content-Type": "application/json" });
  });
  it("returns undefined for a 204", async () => {
    reply(204);
    await expect(apiFetch("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });
  it.each(["not_logged_in", "missing_api_key", "missing_admin_key"])("a 401 %s navigates to login, then throws", async (code) => {
    reply(401, { error: code });
    await expect(apiFetch("/api/projects/p1/addresses")).rejects.toMatchObject({ status: 401, code });
    expect(navigate).toHaveBeenCalledWith(EXPIRED);
  });
  it("a 401 invalid_credentials does not navigate", async () => {
    reply(401, { error: "invalid_credentials" });
    await expect(apiFetch("/auth/login", { method: "POST", body: {} })).rejects.toMatchObject({ code: "invalid_credentials" });
    expect(navigate).not.toHaveBeenCalled();
  });
  it("a 404 project_not_found invalidates ['me'] and goes to /", async () => {
    reply(404, { error: "project_not_found" });
    await expect(apiFetch("/api/projects/p1/members")).rejects.toMatchObject({ code: "project_not_found" });
    expect(invalidateMe).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/");
    expect(navigate).not.toHaveBeenCalled();
  });
  it("stayOnProjectGone: a 404 project_not_found throws without leaving the page", async () => {
    reply(404, { error: "project_not_found" });
    await expect(apiFetch("/api/projects/p1", { method: "DELETE", stayOnProjectGone: true })).rejects.toMatchObject({ code: "project_not_found" });
    expect(invalidateMe).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
  it("a 403 bad_origin throws with that code", async () => {
    reply(403, { error: "bad_origin" });
    await expect(apiFetch("/api/projects/p1/addresses", { method: "POST", body: {} })).rejects.toMatchObject({ status: 403, code: "bad_origin" });
    expect(navigate).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
  it("keeps field, index and problem", async () => {
    reply(400, { error: "invalid_request", field: "addresses", index: 3, problem: "is not a TON address" });
    const error = await apiFetch("/api/projects/p1/addresses", { method: "POST", body: {} }).catch((e: unknown) => e);
    expect(error).toEqual(new ApiError(400, "invalid_request", "addresses", 3, "is not a TON address"));
  });
  it("maps a failed fetch to network", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(apiFetch("/api/projects")).rejects.toMatchObject({ status: 0, code: "network" });
  });
  it("maps a 5xx without a code to internal_error", async () => {
    reply(500);
    await expect(apiFetch("/api/projects")).rejects.toMatchObject({ code: "internal_error" });
  });
});

describe("gql", () => {
  it("posts to /api/graphql and returns data", async () => {
    reply(200, { data: { project: { id: "p1" } } });
    await expect(gql("query { project(id: $id) { id } }", { id: "p1" })).resolves.toEqual({ project: { id: "p1" } });
    const [path, init] = vi.mocked(fetch).mock.calls[0];
    expect(path).toBe("/api/graphql");
    expect(init?.method).toBe("POST");
  });
  it("UNAUTHENTICATED navigates to login", async () => {
    gqlErrors("UNAUTHENTICATED", "not signed in");
    await expect(gql("query { x }")).rejects.toEqual(new GqlError("UNAUTHENTICATED", "not signed in"));
    expect(navigate).toHaveBeenCalledWith(EXPIRED);
  });
  it("FORBIDDEN 'Origin: not allowed' throws bad_origin", async () => {
    gqlErrors("FORBIDDEN", "Origin: not allowed");
    await expect(gql("query { x }")).rejects.toMatchObject({ code: "bad_origin" });
    expect(navigate).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
  it("FORBIDDEN 'id: …' is handled like project_not_found", async () => {
    gqlErrors("FORBIDDEN", "id: not a project you can read");
    await expect(gql("query { x }")).rejects.toMatchObject({ code: "project_not_found" });
    expect(invalidateMe).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/");
  });
  it("FORBIDDEN 'address: …' stays FORBIDDEN for the hook to retry", async () => {
    gqlErrors("FORBIDDEN", "address: is not linked to this project");
    await expect(gql("query { x }")).rejects.toEqual(new GqlError("FORBIDDEN", "address: is not linked to this project"));
    expect(push).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
  it("a forwarder error (502) throws ApiError", async () => {
    reply(502, { error: "api_unreachable" });
    await expect(gql("query { x }")).rejects.toMatchObject({ status: 502, code: "api_unreachable" });
  });
  it("a 401 from the forwarder navigates to login", async () => {
    reply(401, { error: "not_logged_in" });
    await expect(gql("query { x }")).rejects.toMatchObject({ code: "not_logged_in" });
    expect(navigate).toHaveBeenCalledWith(EXPIRED);
  });
});
