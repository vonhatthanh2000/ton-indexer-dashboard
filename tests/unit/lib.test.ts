import { afterEach, describe, expect, it, vi } from "vitest";
import { LIVE_POLL_MS, PROJECT_TRANSACTIONS_QUERY, livePollInterval, nextCursor } from "@/lib/feed";
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

function tx(hash: string, utime: string, lt: string, account = "0:AA"): Transaction {
  return { account, hash, utime, lt, time: "", traceId: null, inMsgOpcode: null, sender: null, value: null, aborted: false, fee: null, outMsgs: [] };
}

describe("feed", () => {
  it("projectTransactions takes the id and cursor as variables", () => {
    expect(PROJECT_TRANSACTIONS_QUERY).toContain("$id: String!");
    expect(PROJECT_TRANSACTIONS_QUERY).toContain("$before: TransactionCursor");
    expect(PROJECT_TRANSACTIONS_QUERY).toMatch(/projectTransactions\([^)]*before: \$before/);
    expect(PROJECT_TRANSACTIONS_QUERY).toContain("account");
  });
  it("next cursor is the last row's utime, lt and account, as strings", () => {
    const page = [tx("a", "200", "9007199254740995", "0:BB"), tx("b", "100", "9007199254740993", "0:CC")];
    expect(nextCursor(page, 2)).toEqual({ utime: "100", lt: "9007199254740993", account: "0:CC" });
  });
  it("a short page means nothing older", () => {
    expect(nextCursor([tx("a", "1", "1")], 20)).toBeUndefined();
    expect(nextCursor([], 20)).toBeUndefined();
  });
  it("polls every 5 s only while just the first page is loaded", () => {
    expect(livePollInterval(1)).toBe(LIVE_POLL_MS);
    expect(LIVE_POLL_MS).toBe(5000);
    expect(livePollInterval(2)).toBe(false);
    expect(livePollInterval(undefined)).toBe(false);
  });
});
