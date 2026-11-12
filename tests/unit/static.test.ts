import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { sealData } from "iron-session";
import { describe, expect, it } from "vitest";
import { MAX_PROJECT_KEYS, withProjectKey, type ProjectKeyEntry } from "@/server/session";

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

describe("styling comes from tokens (PLAN.md acceptance criteria)", () => {
  const files = tsxFiles("src");
  it("no hex colours in .tsx files", () => {
    const hits = files.flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line, index) => ({ file, line: index + 1, text: line }))
        .filter(({ text }) => /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b/.test(text) && !/href=|#main|\/\//.test(text)),
    );
    expect(hits).toEqual([]);
  });
  it("no px values in class names or style objects", () => {
    const hits = files.flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line, index) => ({ file, line: index + 1, text: line }))
        .filter(({ text }) => /\[\d+(?:\.\d+)?px\]/.test(text) || /:\s*"[^"]*\d+px[^"]*"/.test(text)),
    );
    expect(hits).toEqual([]);
  });
});

describe("project-keys cookie size", () => {
  it("20 entries stay under the 4 KB cookie limit", async () => {
    let entries: ProjectKeyEntry[] = [];
    for (let index = 0; index < MAX_PROJECT_KEYS; index += 1) {
      entries = withProjectKey(entries, crypto.randomUUID(), "k".repeat(43), Date.now() + index);
    }
    const sealed = await sealData({ entries }, { password: process.env.SESSION_SECRET!, ttl: 43200 });
    expect(`tonobs_pkeys=${sealed}; Path=/; HttpOnly; SameSite=Strict`.length).toBeLessThan(4000);
  });
});
