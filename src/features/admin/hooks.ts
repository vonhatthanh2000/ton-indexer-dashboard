"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ME_KEY } from "@/features/auth/use-me";
import { projectKeys } from "@/features/project/hooks";
import { ApiError, apiFetch } from "@/lib/client";
import type { AdminProjectsReply, AdminUserReply, CreatedProjectReply, RenamedProjectReply } from "@/lib/types";

/** Admin query keys start with `["admin", …]`. */
export const adminKeys = {
  projects: ["admin", "projects"] as const,
};

/** `GET /api/projects`: every project (admins only). */
export function useAdminProjects() {
  return useQuery({
    queryKey: adminKeys.projects,
    queryFn: ({ signal }) => apiFetch<AdminProjectsReply>("/api/projects", { signal }),
    select: (data) => data.projects,
  });
}

/** `POST /api/projects {name, ownerEmail}` (201). The new project shows up in ["me"] too. */
export function useCreateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; ownerEmail: string }) =>
      apiFetch<CreatedProjectReply>("/api/projects", { method: "POST", body }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.projects });
      void client.invalidateQueries({ queryKey: ME_KEY });
    },
  });
}

/** `POST /api/users {email, isAdmin: true}`: 201 (created) and 200 (already existed) both succeed. */
export function useAddAdmin() {
  return useMutation({
    mutationFn: (email: string) => apiFetch<AdminUserReply>("/api/users", { method: "POST", body: { email, isAdmin: true } }),
  });
}

function projectUrl(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}`;
}

/**
 * `PATCH /api/projects/:id {name}`. The name shows in GET /projects, ["me"] and the project's own
 * queries, so all three are refreshed. A 404 refreshes the list instead of leaving the page.
 */
export function useRenameProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, name }: { projectId: string; name: string }) =>
      apiFetch<RenamedProjectReply>(projectUrl(projectId), { method: "PATCH", body: { name }, stayOnProjectGone: true }),
    onSettled: (_data, _error, { projectId }) => {
      void client.invalidateQueries({ queryKey: adminKeys.projects });
      void client.invalidateQueries({ queryKey: ME_KEY });
      void client.invalidateQueries({ queryKey: projectKeys.info(projectId) });
    },
  });
}

/**
 * `DELETE /api/projects/:id` (204). A 404 `project_not_found` means it is already gone, which is
 * what the admin wanted: it resolves `{ alreadyGone: true }` instead of throwing. The caller leaves
 * any `/projects/:id/…` page before calling `forget`, so the page doesn't flash "No access".
 */
export function useDeleteProject() {
  return useMutation({
    mutationFn: async (projectId: string): Promise<{ alreadyGone: boolean }> => {
      try {
        await apiFetch<void>(projectUrl(projectId), { method: "DELETE", stayOnProjectGone: true });
        return { alreadyGone: false };
      } catch (error) {
        if (error instanceof ApiError && error.code === "project_not_found") return { alreadyGone: true };
        throw error;
      }
    },
  });
}

/**
 * After a delete: drop the project from the admin list and refresh ["me"]. The project's own
 * queries are only cancelled (not removed): removing them while its page is still mounted would
 * refetch and bounce to `/`. When the caller is leaving that page (`leaving`), ["me"] is only
 * marked stale, so the page doesn't flash "No access"; `/admin` refetches it on mount.
 */
export function useForgetProject() {
  const client = useQueryClient();
  return (projectId: string, { leaving = false }: { leaving?: boolean } = {}) => {
    void client.cancelQueries({ queryKey: projectKeys.all(projectId) });
    client.setQueryData<AdminProjectsReply>(adminKeys.projects, (data) =>
      data ? { projects: data.projects.filter((row) => row.id !== projectId) } : data,
    );
    void client.invalidateQueries({ queryKey: adminKeys.projects });
    void client.invalidateQueries({ queryKey: ME_KEY, refetchType: leaving ? "none" : "active" });
  };
}
