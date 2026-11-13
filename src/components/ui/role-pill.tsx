import type { ProjectRole } from "@/lib/types";
import { Pill, type PillTone } from "./pill";

const ROLE: Record<ProjectRole, { label: string; tone: PillTone }> = {
  owner: { label: "Owner", tone: "primary" },
  editor: { label: "Editor", tone: "ok" },
  viewer: { label: "Viewer", tone: "neutral" },
  // An admin on a project they are not a member of.
  admin: { label: "Admin", tone: "neutral" },
};

export function roleLabel(role: ProjectRole): string {
  return ROLE[role].label;
}

export function RolePill({ role }: { role: ProjectRole }) {
  return <Pill tone={ROLE[role].tone}>{ROLE[role].label}</Pill>;
}
