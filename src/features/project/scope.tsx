"use client";

import { createContext, useContext, type ReactNode } from "react";
import { NoAccess } from "@/components/ui/no-access";
import { useMe } from "@/features/auth/use-me";
import type { ProjectRole } from "@/lib/types";

export interface ProjectScopeValue {
  projectId: string;
  projectName: string;
  /** The caller's role here, from `me.projects` (the client ["me"] query). */
  role: ProjectRole;
  isAdmin: boolean;
  userId: string;
}

const ProjectScopeContext = createContext<ProjectScopeValue | null>(null);

/**
 * `/projects/[id]/*`: the id must be one of `me.projects`, else NoAccess. The role follows the
 * client ["me"] query, so a role change shows up after an invalidation without a reload.
 */
export function ProjectScope({ projectId, children }: { projectId: string; children: ReactNode }) {
  const me = useMe().data;
  const project = me?.projects.find((row) => row.id === projectId);
  if (!me || !project) return <NoAccess />;
  return (
    <ProjectScopeContext.Provider
      value={{ projectId, projectName: project.name, role: project.role, isAdmin: me.user.isAdmin, userId: me.user.id }}
    >
      {children}
    </ProjectScopeContext.Provider>
  );
}

/** Pages under `/projects/[id]` read the project id and the caller's role here. */
export function useProjectScope(): ProjectScopeValue {
  const value = useContext(ProjectScopeContext);
  if (!value) throw new Error("useProjectScope outside <ProjectScope>");
  return value;
}
