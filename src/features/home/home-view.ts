import type { Me } from "@/lib/types";

/** What `/` shows (PLAN.md Decisions › Routes and screens). */
export type HomeView =
  | { kind: "redirect"; href: string }
  | { kind: "empty-member" }
  | { kind: "empty-admin" }
  | { kind: "list" };

export function homeView(me: Me): HomeView {
  const admin = me.user.isAdmin;
  if (!admin && me.projects.length === 1) {
    return { kind: "redirect", href: `/projects/${encodeURIComponent(me.projects[0].id)}` };
  }
  if (me.projects.length === 0) return admin ? { kind: "empty-admin" } : { kind: "empty-member" };
  return { kind: "list" };
}
