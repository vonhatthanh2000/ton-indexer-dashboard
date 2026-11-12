import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, GqlError, apiFetch, gql, loginUrlForExpiry, setNavigate } from "@/lib/client";
import { buildFeedQuery, mergeFeed } from "@/lib/feed";
import { compactNumber, formatTon, groupDigits, relativeTime, shorten } from "@/lib/format";
import { filterBy, hasNextPage, paginate } from "@/lib/paging";
import type { Transaction } from "@/lib/types";

afterEach(() => vi.unstubAllGlobals());

describe("format", () => {
  it("formats TON exactly and compactly", () => {
    expect(formatTon("1234567890123456789")).toEqual({
      short: "1.23B TON",
      exact: "1234567890.123456789 TON (1234567890123456789 nanoton)",
    });
    expect(formatTon("2500000000").short).toBe("2.5 TON");
    expect(formatTon("3100000").short).toBe("0.0031 TON");
    expect(formatTon("1").short).toBe("<0.0001 TON");
  });
  it("compacts big counts only", () => {
    expect(compactNumber(1240000)).toBe("1.24M");
    expect(compactNumber(9999)).toBe("9,999");
  });
  it("relative time and helpers", () => {
    const now = Date.parse("2026-11-12T10:00:00Z");
    expect(relativeTime("2026-11-12T09:58:00Z", now)).toBe("2 minutes ago");
    expect(relativeTime("2026-11-12T09:59:50Z", now)).toBe("just now");
    expect(groupDigits("1234567")).toBe("1 234 567");
    expect(shorten("EQCxE6mUtQJKFnGf", 4, 4)).toBe("EQCx…FnGf");
  });
});

describe("paging", () => {
  const rows = Array.from({ length: 25 }, (_, index) => ({ name: `p${index}` }));
  it("slices and clamps", () => {
    expect(paginate(rows, 3, 10).rows.map((row) => row.name)).toEqual(["p20", "p21", "p22", "p23", "p24"]);
    expect(paginate(rows, 99, 10).page).toBe(3);
    expect(paginate([], 1, 10).pageCount).toBe(1);
  });
  it("filters case-insensitively", () => {
    expect(filterBy(rows, "P2", (row) => [row.name]).length).toBe(6);
  });
  it("has a next page only after a full page", () => {
    expect(hasNextPage(100, 100)).toBe(true);
    expect(hasNextPage(99, 100)).toBe(false);
  });
});

function tx(hash: string, utime: string, lt: string): Transaction {
  return { hash, utime, lt, time: "", traceId: null, inMsgOpcode: null, sender: null, value: null, aborted: false, fee: null, outMsgs: [] };
}

describe("feed", () => {
  it("builds variables, never inlines addresses", () => {
    const built = buildFeedQuery(["0:AA", "0:BB"])!;
    expect(built.variables).toEqual({ a0: "0:AA", a1: "0:BB" });
    expect(built.query).not.toContain("0:AA");
    expect(built.query).toContain("$a1: String!");
  });
  it("returns null for no addresses and caps at 20", () => {
    expect(buildFeedQuery([])).toBeNull();
    const many = Array.from({ length: 25 }, (_, index) => `0:${index}`);
    expect(Object.keys(buildFeedQuery(many)!.variables)).toHaveLength(20);
  });
  it("merges newest first by utime then lt (BigInt)", () => {
    const merged = mergeFeed(
      {
        a0: [tx("a", "100", "9007199254740993"), tx("b", "90", "5")],
        a1: [tx("c", "100", "9007199254740995"), tx("d", "120", "1")],
      },
      ["0:A", "0:B"],
    );
    expect(merged.map((row) => row.hash)).toEqual(["d", "c", "a", "b"]);
    expect(merged[0].account).toBe("0:B");
  });
});

describe("client", () => {
  it("sends the CSRF header on writes and maps errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: "invalid_request", field: "name", problem: "is required" }, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetch("/api/admin/projects", { method: "POST", body: {} })).rejects.toMatchObject({
      status: 400,
      code: "invalid_request",
      field: "name",
    });
    expect(fetchMock.mock.calls[0][1].headers["X-Requested-With"]).toBe("dashboard");
  });
  it("navigates to login on session_expired", async () => {
    const go = vi.fn();
    setNavigate(go);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "session_expired" }, { status: 401 })));
    await expect(apiFetch("/api/admin/projects")).rejects.toBeInstanceOf(ApiError);
    expect(go).toHaveBeenCalledWith("/login?reason=expired");
    expect(loginUrlForExpiry("/admin/projects")).toBe("/login?reason=expired&next=%2Fadmin%2Fprojects");
  });
  it("throws GqlError on errors even with HTTP 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ data: null, errors: [{ message: "address: is not linked", extensions: { code: "FORBIDDEN" } }] })),
    );
    await expect(gql("query { x }")).rejects.toEqual(new GqlError("FORBIDDEN", "address: is not linked"));
  });
});
