import { describe, expect, it } from "vitest";
import { projectsPerMonth } from "@/lib/chart";

describe("projectsPerMonth", () => {
  const now = new Date("2026-11-12T10:00:00Z");
  it("is empty without projects", () => {
    expect(projectsPerMonth([], now)).toEqual([]);
  });
  it("zero-fills gaps from the first month to now (UTC)", () => {
    const buckets = projectsPerMonth(["2026-08-31T23:30:00Z", "2026-10-01T00:00:00Z", "2026-10-15T00:00:00Z"], now);
    expect(buckets.map((bucket) => [bucket.key, bucket.count])).toEqual([
      ["2026-08", 1],
      ["2026-09", 0],
      ["2026-10", 2],
      ["2026-11", 0],
    ]);
    expect(buckets[0].label).toBe("Aug 2026");
  });
  it("keeps at most the last 12 months", () => {
    const buckets = projectsPerMonth(["2024-01-01T00:00:00Z", "2026-11-01T00:00:00Z"], now);
    expect(buckets).toHaveLength(12);
    expect(buckets[0].key).toBe("2025-12");
    expect(buckets.at(-1)).toMatchObject({ key: "2026-11", count: 1 });
  });
});
