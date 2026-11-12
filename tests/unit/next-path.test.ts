import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/features/auth/next-path";

describe("safeNextPath", () => {
  it("keeps same-origin workspace paths for the right role", () => {
    expect(safeNextPath("/admin/projects", "admin")).toBe("/admin/projects");
    expect(safeNextPath("/project/transactions?address=EQ", "project")).toBe("/project/transactions?address=EQ");
  });
  it("drops other roles, other origins and odd paths", () => {
    expect(safeNextPath("/project", "admin")).toBeNull();
    expect(safeNextPath("//evil.example/admin", "admin")).toBeNull();
    expect(safeNextPath("https://evil.example/admin", "admin")).toBeNull();
    expect(safeNextPath("/admin\\..", "admin")).toBeNull();
    expect(safeNextPath("/administrator", "admin")).toBeNull();
  });
});
