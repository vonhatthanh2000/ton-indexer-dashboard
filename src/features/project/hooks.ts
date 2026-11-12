"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { GqlError, gql } from "@/lib/client";
import { TRANSACTION_FIELDS, buildFeedQuery, mergeFeed } from "@/lib/feed";
import type { FeedTransaction, MyProject, Transaction } from "@/lib/types";

export const TX_PAGE_SIZE = 20;

export const projectKeys = {
  project: ["pm", "project"] as const,
  feed: (addresses: string[]) => ["pm", "feed", addresses] as const,
  transactions: (address: string) => ["pm", "tx", address] as const,
};

const PROJECT_QUERY = `query DashboardProject { project { id name addresses { address state startLt lastLt stillSyncing } } }`;

const TRANSACTIONS_QUERY = `query DashboardTransactions($address: String!, $limit: Int!, $beforeLt: String) {
  transactions(address: $address, limit: $limit, beforeLt: $beforeLt) { ${TRANSACTION_FIELDS} }
}`;

export function useMyProject(options: { refetchOnWindowFocus?: boolean } = {}) {
  return useQuery({
    queryKey: projectKeys.project,
    queryFn: () => gql<{ project: MyProject }>(PROJECT_QUERY).then((data) => data.project),
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? false,
  });
}

/** One aliased query; on FORBIDDEN refetch the project and retry once (PLAN.md PM dashboard feed). */
export function useLatestFeed(addresses: string[] | undefined) {
  const client = useQueryClient();
  return useQuery({
    queryKey: projectKeys.feed(addresses ?? []),
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
          queryKey: projectKeys.project,
          queryFn: () => gql<{ project: MyProject }>(PROJECT_QUERY).then((data) => data.project),
          staleTime: 0,
        });
        return run(project.addresses.map((row) => row.address));
      }
    },
  });
}

export function useTransactions(address: string | undefined) {
  return useInfiniteQuery({
    queryKey: projectKeys.transactions(address ?? ""),
    enabled: Boolean(address),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      gql<{ transactions: Transaction[] }>(TRANSACTIONS_QUERY, {
        address,
        limit: TX_PAGE_SIZE,
        beforeLt: pageParam,
      }).then((data) => data.transactions),
    getNextPageParam: (lastPage) => (lastPage.length < TX_PAGE_SIZE ? undefined : lastPage[lastPage.length - 1].lt),
  });
}
