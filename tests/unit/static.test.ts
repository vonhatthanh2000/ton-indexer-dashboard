import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
