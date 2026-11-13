"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ME_KEY } from "@/features/auth/use-me";
import { apiFetch } from "@/lib/client";
import type { AdminProjectsReply, AdminUserReply, CreatedProjectReply } from "@/lib/types";

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
