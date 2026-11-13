"use client";

import { Activity, Inbox, Loader, Wallet } from "lucide-react";
import Link from "next/link";
import { AddressChip } from "@/components/chain/address-chip";
import { HashChip } from "@/components/chain/hash-chip";
import { TxStatusPill, addressStatus } from "@/components/chain/status-pills";
import { RelativeTime, TonAmount } from "@/components/chain/values";
import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink, Card, CardHeader, DataTable, EmptyState, ErrorState, KpiCard, SkeletonRows } from "@/components/ui";
import { errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import { exactNumber } from "@/lib/format";
import { can } from "@/lib/roles";
import type { Transaction } from "@/lib/types";
import { useLatestFeed, useProject } from "./hooks";
import { useProjectScope } from "./scope";
import { DestinationCell, SenderCell, projectBase, txHref } from "./tx-parts";

/** "No addresses yet": a writer gets a link to register them, everyone else whom to ask. */
export function NoAddressesYet({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  return canWrite ? (
    <EmptyState
      icon={Inbox}
      title="No addresses yet"
      body="Register the addresses this project should index."
      action={
        <ButtonLink href={`${projectBase(projectId)}/addresses`} variant="primary">
          Go to addresses
        </ButtonLink>
      }
    />
  ) : (
    <EmptyState icon={Inbox} title="No addresses yet" body="Ask a project owner or editor to register them." />
  );
}

export function ProjectDashboard() {
  const { projectId, projectName, role } = useProjectScope();
  const project = useProject(projectId, { refetchOnWindowFocus: true });
  const rows = project.data?.addresses ?? [];
  const feed = useLatestFeed(projectId, rows.length > 0);
  const statuses = rows.map(addressStatus);
  const live = statuses.filter((status) => status === "live").length;
  const syncing = statuses.length - live;
  const projectError = project.error ? errorText({ code: errorCode(project.error) }) : null;

  return (
    <>
      <PageHeader title="Dashboard" crumbs={[{ label: "Projects", href: "/" }, { label: projectName }]} />
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard icon={Wallet} label="Tracked addresses" loading={project.isLoading} value={projectError ? "—" : exactNumber(rows.length)} />
        <KpiCard icon={Activity} label="Live" loading={project.isLoading} value={projectError ? "—" : exactNumber(live)} />
        <KpiCard icon={Loader} label="Syncing" loading={project.isLoading} value={projectError ? "—" : exactNumber(syncing)} />
      </div>

      <Card className="mt-6" aria-labelledby="feed-title">
        <CardHeader
          title="Latest transactions"
          titleId="feed-title"
          subtitle="Newest across every address. Updates every 5 seconds."
          actions={
            rows.length > 0 ? (
              <Link href={`${projectBase(projectId)}/transactions`} className="link font-medium">
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
          <NoAddressesYet projectId={projectId} canWrite={can(role, "writeAddresses")} />
        ) : feed.error && !feed.data ? (
          <ErrorState message={errorText({ code: errorCode(feed.error) })} onRetry={() => void feed.refetch()} />
        ) : (feed.data ?? []).length === 0 ? (
          <EmptyState icon={Inbox} title="No transactions stored yet" body="History may still be syncing." />
        ) : (
          <DataTable<Transaction>
            caption="Latest transactions"
            rows={feed.data ?? []}
            rowKey={(row) => `${row.account}-${row.hash}`}
            columns={[
              { key: "address", header: "Address", cell: (row) => <AddressChip address={row.account} href={txHref(projectId, row.account)} /> },
              { key: "hash", header: "Tx hash", cell: (row) => <HashChip hash={row.hash} /> },
              { key: "sender", header: "Sender", cell: (row) => <SenderCell tx={row} /> },
              { key: "destination", header: "Destination", cell: (row) => <DestinationCell tx={row} /> },
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
