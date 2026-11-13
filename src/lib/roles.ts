// What the UI offers per role; it mirrors the API's checks (PLAN.md Decisions › Roles in the UI).
// An action `can` denies is not rendered. The API still decides: a 403 shows its text.
import type { ProjectRole } from "./types";

export type Action = "writeAddresses" | "manageMembers" | "issueKey" | "resendInvite" | "addOwner" | "manageProject";

/**
 * `role` is the caller's role on the project from `me.projects` (undefined when not listed);
 * `isAdmin` is `me.user.isAdmin`.
 */
export function can(role: ProjectRole | null | undefined, action: Action, isAdmin = false): boolean {
  switch (action) {
    case "writeAddresses":
      return role === "owner" || role === "editor";
    case "manageMembers":
    case "issueKey":
      return role === "owner";
    case "resendInvite":
      return role === "owner" || role === "admin";
    case "addOwner":
    case "manageProject": // rename, delete
      // The API checks only isAdmin, whatever the project role.
      return isAdmin;
  }
}
