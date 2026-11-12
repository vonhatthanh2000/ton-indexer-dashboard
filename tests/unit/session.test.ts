import { describe, expect, it } from "vitest";
import {
  MAX_PROJECT_KEYS,
  SESSION_COOKIE,
  findProjectKey,
  isExpired,
  readSession,
  sealSession,
  withProjectKey,
  withoutProjectKey,
} from "@/server/session";

const HOUR = 3_600_000;

function jar(value?: string) {
  return { get: (name: string) => (name === SESSION_COOKIE && value ? { value } : undefined) };
}

describe("session expiry", () => {
  it("is expired after 12 h", () => {
    const now = Date.now();
    expect(isExpired({ issuedAt: now - 11 * HOUR }, now)).toBe(false);
    expect(isExpired({ issuedAt: now - 13 * HOUR }, now)).toBe(true);
  });
  it("reads a fresh session and rejects an old issuedAt", async () => {
    const fresh = await sealSession({ role: "admin", key: "k", issuedAt: Date.now() });
    expect((await readSession(jar(fresh))).kind).toBe("valid");
    const old = await sealSession({ role: "admin", key: "k", issuedAt: Date.now() - 13 * HOUR });
    expect((await readSession(jar(old))).kind).toBe("expired");
  });
  it("treats a missing or tampered cookie correctly", async () => {
    expect((await readSession(jar())).kind).toBe("none");
    expect((await readSession(jar("Fe26.2**garbage"))).kind).toBe("expired");
  });
});

describe("project keys", () => {
  it("caps at 20, dropping the oldest", () => {
    let entries = withProjectKey([], "p0", "k0", 0);
    for (let index = 1; index <= MAX_PROJECT_KEYS; index += 1) {
      entries = withProjectKey(entries, `p${index}`, `k${index}`, index);
    }
    expect(entries).toHaveLength(MAX_PROJECT_KEYS);
    expect(findProjectKey(entries, "p0")).toBeUndefined();
    expect(findProjectKey(entries, "p20")).toBe("k20");
  });
  it("replaces a project's key and drops only that id", () => {
    let entries = withProjectKey([], "a", "1", 1);
    entries = withProjectKey(entries, "b", "2", 2);
    entries = withProjectKey(entries, "a", "3", 3);
    expect(findProjectKey(entries, "a")).toBe("3");
    const dropped = withoutProjectKey(entries, "a");
    expect(dropped.map((entry) => entry.projectId)).toEqual(["b"]);
  });
});
