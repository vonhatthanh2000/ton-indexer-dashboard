"use client";

import { Activity, Inbox, Loader, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { AddressChip } from "@/components/chain/address-chip";
import { HashChip } from "@/components/chain/hash-chip";
import { TxStatusPill, addressStatus } from "@/components/chain/status-pills";
import { RelativeTime, TonAmount } from "@/components/chain/values";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader, DataTable, EmptyState, ErrorState, KpiCard, SkeletonRows } from "@/components/ui";
import { errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import { exactNumber } from "@/lib/format";
import type { FeedTransaction } from "@/lib/types";
import { useLatestFeed, useMyProject } from "./hooks";
import { FlowCell, txHref } from "./tx-parts";

export function ProjectDashboard() {
  const project = useMyProject({ refetchOnWindowFocus: true });
  const addresses = useMemo(() => project.data?.addresses.map((row) => row.address), [project.data]);
  const feed = useLatestFeed(addresses);
  const rows = project.data?.addresses ?? [];
  const statuses = rows.map(addressStatus);
  const live = statuses.filter((status) => status === "live").length;
  const syncing = statuses.length - live;
  const projectError = project.error ? errorText({ code: errorCode(project.error) }) : null;

  return (
    <>
      <PageHeader title="Dashboard" crumbs={[{ label: "Dashboard" }]} />
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard icon={Wallet} label="Tracked addresses" loading={project.isLoading} value={projectError ? "—" : exactNumber(rows.length)} />
        <KpiCard icon={Activity} label="Live" loading={project.isLoading} value={projectError ? "—" : exactNumber(live)} />
        <KpiCard icon={Loader} label="Syncing" loading={project.isLoading} value={projectError ? "—" : exactNumber(syncing)} />
      </div>

      <Card className="mt-6" aria-labelledby="feed-title">
        <CardHeader
          title="Latest transactions"
          titleId="feed-title"
          subtitle={rows.length > 20 ? "Newest across your first 20 addresses" : "Newest across your addresses"}
          actions={
            rows.length > 0 ? (
              <Link href="/project/transactions" className="link font-medium">
                View all transactions →
              </Link>
            ) : null
          }
        />
        {project.isLoading || (feed.isLoading && rows.length > 0) ? (
          <SkeletonRows rows={5} columns={5} />
        ) : projectError ? (
          <ErrorState message={projectError} onRetry={() => void project.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Inbox} title="No addresses yet" body="Ask your admin to register them." />
        ) : feed.error ? (
          <ErrorState message={errorText({ code: errorCode(feed.error) })} onRetry={() => void feed.refetch()} />
        ) : (feed.data ?? []).length === 0 ? (
          <EmptyState icon={Inbox} title="No transactions stored yet" body="History may still be syncing." />
        ) : (
          <DataTable<FeedTransaction>
            caption="Latest transactions"
            rows={feed.data ?? []}
            rowKey={(row) => `${row.account}-${row.hash}`}
            columns={[
              { key: "address", header: "Address", cell: (row) => <AddressChip address={row.account} href={txHref(row.account)} /> },
              { key: "hash", header: "Tx hash", cell: (row) => <HashChip hash={row.hash} /> },
              { key: "flow", header: "From → Out", cell: (row) => <FlowCell tx={row} /> },
              { key: "value", header: "Value", cell: (row) => <TonAmount nano={row.value} /> },
              { key: "status", header: "Status", cell: (row) => <TxStatusPill aborted={row.aborted} /> },
              { key: "time", header: "Time", cell: (row) => <RelativeTime iso={row.time} /> },
            ]}
          />
        )}
      </Card>
    </>
  );
}
