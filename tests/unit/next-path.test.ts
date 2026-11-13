import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/features/auth/next-path";

describe("safeNextPath", () => {
  it.each(["/", "/projects/x", "/admin", "/admin/users", "/account", "/projects/x/transactions?address=EQ", "/?a=1", "/admin?x=1"])(
    "accepts %s",
    (path) => expect(safeNextPath(path)).toBe(path),
  );
  it.each(["//evil", "https://x", "/\\x", "/login", "/login?next=/", "/adminx", "/accounts", "/projectsx", "/projects", "/projects/", "/auth/google", "/api/projects", "/admin\nx", "", null, undefined])(
    "rejects %s",
    (path) => expect(safeNextPath(path)).toBeNull(),
  );
});
