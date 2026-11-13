"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { ME_KEY } from "@/features/auth/use-me";
import { GqlError, apiFetch, errorCode, gql } from "@/lib/client";
import { TRANSACTION_FIELDS, buildFeedQuery, mergeFeed } from "@/lib/feed";
import type {
  AddressPage,
  ApiKeyReply,
  FeedTransaction,
  Me,
  MemberChangeReply,
  MemberRole,
  MembersReply,
  MyProject,
  RegisteredAddress,
  ResendInviteReply,
  Transaction,
} from "@/lib/types";

export const TX_PAGE_SIZE = 20;
export const ADDRESS_PAGE_SIZE = 100;

/** Every project query key starts with `["project", projectId, …]`. */
export const projectKeys = {
  all: (projectId: string) => ["project", projectId] as const,
  info: (projectId: string) => ["project", projectId, "info"] as const,
  feed: (projectId: string, addresses: string[]) => ["project", projectId, "feed", addresses] as const,
  transactions: (projectId: string, address: string) => ["project", projectId, "tx", address] as const,
  addresses: (projectId: string) => ["project", projectId, "addresses"] as const,
  addressPage: (projectId: string, offset: number) => ["project", projectId, "addresses", offset] as const,
  members: (projectId: string) => ["project", projectId, "members"] as const,
};

/** The path of a project REST call (`/api/projects/<id>/…`). */
export function projectPath(projectId: string, rest = ""): string {
  return `/api/projects/${encodeURIComponent(projectId)}${rest}`;
}

const PROJECT_QUERY = `query DashboardProject($id: String!) { project(id: $id) { id name addresses { address state startLt lastLt stillSyncing } } }`;

const TRANSACTIONS_QUERY = `query DashboardTransactions($address: String!, $limit: Int!, $beforeLt: String) {
  transactions(address: $address, limit: $limit, beforeLt: $beforeLt) { ${TRANSACTION_FIELDS} }
}`;

function fetchProject(projectId: string): Promise<MyProject> {
  return gql<{ project: MyProject }>(PROJECT_QUERY, { id: projectId }).then((data) => data.project);
}

const ROLE_DENIED = new Set(["insufficient_role", "owner_only", "admin_only"]);

/**
 * After a role-changing mutation or a 403: refetch ["me"] and re-render the server tree.
 * Resolves to the fresh `me`.
 */
export function useRefreshRoles() {
  const client = useQueryClient();
  const router = useRouter();
  return useCallback(async (): Promise<Me | undefined> => {
    await client.invalidateQueries({ queryKey: ME_KEY });
    router.refresh();
    return client.getQueryData<Me>(ME_KEY);
  }, [client, router]);
}

/** A 403 for a role reason means our ["me"] is stale: refresh it (the caller shows the text). */
export function useOnRoleDenied() {
  const refresh = useRefreshRoles();
  return useCallback(
    (error: unknown) => {
      if (ROLE_DENIED.has(errorCode(error))) void refresh();
    },
    [refresh],
  );
}

// ---- GraphQL: project and transactions ----------------------------------------------------

export function useProject(projectId: string, options: { refetchOnWindowFocus?: boolean } = {}) {
  return useQuery({
    queryKey: projectKeys.info(projectId),
    queryFn: () => fetchProject(projectId),
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? false,
  });
}

/** One aliased query; on FORBIDDEN refetch the project and retry once (as v1). */
export function useLatestFeed(projectId: string, addresses: string[] | undefined) {
  const client = useQueryClient();
  return useQuery({
    queryKey: projectKeys.feed(projectId, addresses ?? []),
    enabled: addresses !== undefined && addresses.length > 0,
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async (): Promise<FeedTransaction[]> => {
      const run = async (list: string[]) => {
        const built = buildFeedQuery(list);
        if (!built) return [];
        const data = await gql<Record<string, Transaction[]>>(built.query, built.variables);
        return mergeFeed(data, list);
      };
      try {
        return await run(addresses ?? []);
      } catch (error) {
        if (!(error instanceof GqlError) || error.code !== "FORBIDDEN") throw error;
        const project = await client.fetchQuery({
          queryKey: projectKeys.info(projectId),
          queryFn: () => fetchProject(projectId),
          staleTime: 0,
        });
        return run(project.addresses.map((row) => row.address));
      }
    },
  });
}

export function useTransactions(projectId: string, address: string | undefined) {
  const client = useQueryClient();
  return useInfiniteQuery({
    queryKey: projectKeys.transactions(projectId, address ?? ""),
    enabled: Boolean(address),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const run = () =>
        gql<{ transactions: Transaction[] }>(TRANSACTIONS_QUERY, {
          address,
          limit: TX_PAGE_SIZE,
          beforeLt: pageParam,
        }).then((data) => data.transactions);
      try {
        return await run();
      } catch (error) {
        // FORBIDDEN "address: …": the address was unlinked meanwhile; refresh the picker, whose
        // new list moves the page to a linked address.
        if (error instanceof GqlError && error.code === "FORBIDDEN") {
          void client.invalidateQueries({ queryKey: projectKeys.info(projectId) });
        }
        throw error;
      }
    },
    getNextPageParam: (lastPage) => (lastPage.length < TX_PAGE_SIZE ? undefined : lastPage[lastPage.length - 1].lt),
  });
}

// ---- REST: addresses ----------------------------------------------------------------------

export const SYNC_POLL_MS = 10_000;

/** 10 s while any row on the page is still syncing, else no polling. */
export function syncPollInterval(page: AddressPage | undefined): number | false {
  return page?.addresses.some((row) => row.stillSyncing) ? SYNC_POLL_MS : false;
}

/** One page; while a row on it is still syncing, refetch every 10 s. */
export function useAddressPage(projectId: string, offset: number) {
  return useQuery({
    queryKey: projectKeys.addressPage(projectId, offset),
    queryFn: ({ signal }) =>
      apiFetch<AddressPage>(projectPath(projectId, `/addresses?limit=${ADDRESS_PAGE_SIZE}&offset=${offset}`), { signal }),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => syncPollInterval(query.state.data),
  });
}

function invalidateAddresses(client: ReturnType<typeof useQueryClient>, projectId: string) {
  void client.invalidateQueries({ queryKey: projectKeys.addresses(projectId) });
  void client.invalidateQueries({ queryKey: projectKeys.info(projectId) });
}

export function useRegisterAddresses(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { addresses: string[]; startLt: string }) =>
      apiFetch<{ addresses: RegisteredAddress[] }>(projectPath(projectId, "/addresses"), { method: "POST", body }),
    onSuccess: () => invalidateAddresses(client, projectId),
  });
}

export function useUnlinkAddress(projectId: string, offset: number) {
  const client = useQueryClient();
  const key = projectKeys.addressPage(projectId, offset);
  return useMutation({
    mutationFn: (address: string) =>
      apiFetch<void>(projectPath(projectId, `/addresses/${encodeURIComponent(address)}`), { method: "DELETE" }),
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
    onSettled: () => invalidateAddresses(client, projectId),
  });
}

// ---- REST: members ------------------------------------------------------------------------

export function useMembers(projectId: string) {
  return useQuery({
    queryKey: projectKeys.members(projectId),
    queryFn: ({ signal }) => apiFetch<MembersReply>(projectPath(projectId, "/members"), { signal }),
    select: (data) => data.members,
  });
}

export function usePutMember(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: MemberRole }) =>
      apiFetch<MemberChangeReply>(projectPath(projectId, "/members"), { method: "PUT", body }),
    onSettled: () => client.invalidateQueries({ queryKey: projectKeys.members(projectId) }),
  });
}

export function useRemoveMember(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<void>(projectPath(projectId, `/members/${encodeURIComponent(userId)}`), { method: "DELETE" }),
    onSettled: () => client.invalidateQueries({ queryKey: projectKeys.members(projectId) }),
  });
}

export function useResendInvite(projectId: string) {
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<ResendInviteReply>(projectPath(projectId, `/members/${encodeURIComponent(userId)}/invite`), {
        method: "POST",
      }),
  });
}

export function useAddOwner(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch<MemberChangeReply>(projectPath(projectId, "/owners"), { method: "POST", body: { email } }),
    onSettled: () => client.invalidateQueries({ queryKey: projectKeys.members(projectId) }),
  });
}

// ---- REST: API key ------------------------------------------------------------------------

export function useIssueApiKey(projectId: string) {
  return useMutation({
    mutationFn: () => apiFetch<ApiKeyReply>(projectPath(projectId, "/api-key"), { method: "POST" }),
    // The key is shown once; don't keep it in the mutation cache.
    gcTime: 0,
  });
}
