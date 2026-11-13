import { describe, expect, it } from "vitest";
import { can, type Action } from "@/lib/roles";
import type { ProjectRole } from "@/lib/types";

// PLAN.md Decisions › Roles in the UI.
const ALLOWED: Record<Action, (role: ProjectRole | undefined, isAdmin: boolean) => boolean> = {
  writeAddresses: (role) => role === "owner" || role === "editor",
  manageMembers: (role) => role === "owner",
  issueKey: (role) => role === "owner",
  resendInvite: (role) => role === "owner" || role === "admin",
  addOwner: (_role, isAdmin) => isAdmin,
  manageProject: (_role, isAdmin) => isAdmin,
};

const ROLES: (ProjectRole | undefined)[] = ["owner", "editor", "viewer", "admin", undefined];
const ACTIONS = Object.keys(ALLOWED) as Action[];
const rows = ROLES.flatMap((role) =>
  ACTIONS.flatMap((action) => [true, false].map((isAdmin) => ({ role, action, isAdmin, expected: ALLOWED[action](role, isAdmin) }))),
);

describe("can", () => {
  it.each(rows)("$role · $action · isAdmin=$isAdmin → $expected", ({ role, action, isAdmin, expected }) => {
    expect(can(role, action, isAdmin)).toBe(expected);
  });
  it("spot checks", () => {
    expect(can("viewer", "writeAddresses", false)).toBe(false);
    expect(can("editor", "writeAddresses", false)).toBe(true);
    expect(can("editor", "issueKey", true)).toBe(false);
    expect(can("admin", "manageMembers", true)).toBe(false);
    expect(can("admin", "resendInvite", true)).toBe(true);
    expect(can("viewer", "addOwner", true)).toBe(true);
    expect(can("owner", "addOwner", false)).toBe(false);
  });
});
