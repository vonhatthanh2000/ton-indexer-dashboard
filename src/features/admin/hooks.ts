"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client";
import type { AddressPage, IssuedKeyReply, ProjectSummary, RegisteredAddress } from "@/lib/types";

export const ADDRESS_PAGE_SIZE = 100;

export const adminKeys = {
  projects: ["admin", "projects"] as const,
  addresses: (projectId: string) => ["admin", "addresses", projectId] as const,
  addressPage: (projectId: string, offset: number) => ["admin", "addresses", projectId, offset] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: adminKeys.projects,
    queryFn: ({ signal }) => apiFetch<{ projects: ProjectSummary[] }>("/api/admin/projects", { signal }),
    select: (data) => data.projects,
  });
}

export function useCreateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiFetch<IssuedKeyReply>("/api/admin/projects", { method: "POST", body: { name } }),
    gcTime: 0,
    onSuccess: () => client.invalidateQueries({ queryKey: adminKeys.projects }),
  });
}

export function useRotateKey() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiFetch<IssuedKeyReply>(`/api/admin/projects/${projectId}/api-key`, { method: "POST" }),
    gcTime: 0,
    onSuccess: (_data, projectId) => {
      client.invalidateQueries({ queryKey: adminKeys.projects });
      client.invalidateQueries({ queryKey: adminKeys.addresses(projectId) });
    },
  });
}

export function useSaveProjectKey(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      apiFetch<void>(`/api/admin/projects/${projectId}/project-key`, { method: "PUT", body: { key } }),
    gcTime: 0,
    onSuccess: () => client.invalidateQueries({ queryKey: adminKeys.addresses(projectId) }),
  });
}

export function useProjectAddresses(projectId: string, offset: number, enabled = true) {
  return useQuery({
    queryKey: adminKeys.addressPage(projectId, offset),
    queryFn: ({ signal }) =>
      apiFetch<AddressPage>(
        `/api/admin/projects/${projectId}/addresses?limit=${ADDRESS_PAGE_SIZE}&offset=${offset}`,
        { signal },
      ),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useRegisterAddresses(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { addresses: string[]; startLt: string }) =>
      apiFetch<{ addresses: RegisteredAddress[] }>(`/api/admin/projects/${projectId}/addresses`, {
        method: "POST",
        body,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: adminKeys.addresses(projectId) }),
  });
}

export function useUnlinkAddress(projectId: string, offset: number) {
  const client = useQueryClient();
  const key = adminKeys.addressPage(projectId, offset);
  return useMutation({
    mutationFn: (address: string) =>
      apiFetch<void>(`/api/admin/projects/${projectId}/addresses/${encodeURIComponent(address)}`, {
        method: "DELETE",
      }),
    onMutate: async (address) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<AddressPage>(key);
      if (previous) {
        client.setQueryData<AddressPage>(key, {
          ...previous,
          addresses: previous.addresses.filter((row) => row.address !== address),
        });
      }
      return { previous };
    },
    onError: (_error, _address, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: adminKeys.addresses(projectId) }),
  });
}
