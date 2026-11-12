"use client";

import { ArrowRight, Inbox, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AddressChip } from "@/components/chain/address-chip";
import { AddressStatusPill, addressStatus } from "@/components/chain/status-pills";
import { LtText } from "@/components/chain/values";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader, DataTable, EmptyState, ErrorState, Pagination, SkeletonRows } from "@/components/ui";
import { errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import { exactNumber } from "@/lib/format";
import { filterBy, paginate } from "@/lib/paging";
import { toFriendly } from "@/lib/ton";
import type { ProjectAddress } from "@/lib/types";
import { useMyProject } from "./hooks";
import { txHref } from "./tx-parts";

const PAGE_SIZE = 20;

function friendly(address: string): string {
  try {
    return toFriendly(address);
  } catch {
    return address;
  }
}

export function AddressesPage() {
  const { data, isLoading, error, refetch } = useMyProject();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const all = useMemo(() => data?.addresses ?? [], [data]);
  const filtered = useMemo(() => filterBy(all, query, (row) => [row.address, friendly(row.address)]), [all, query]);
  const current = paginate(filtered, page, PAGE_SIZE);

  return (
    <>
      <PageHeader title="Addresses" crumbs={[{ label: "Dashboard", href: "/project" }, { label: "Addresses" }]} />
      <Card aria-labelledby="pm-addresses-title">
        <CardHeader
          title="Addresses"
          titleId="pm-addresses-title"
          subtitle={data ? `${exactNumber(all.length)} tracked by ${data.name}` : "Addresses your project tracks"}
          actions={
            <div className="relative w-72 max-w-full">
              <Search size={16} strokeWidth={1.5} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-2" />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search EQ…, UQ… or 0:…"
                aria-label="Search addresses"
                className="input pl-10"
              />
            </div>
          }
        />
        {isLoading ? (
          <SkeletonRows rows={6} columns={4} />
        ) : error ? (
          <ErrorState message={errorText({ code: errorCode(error) })} onRetry={() => void refetch()} />
        ) : all.length === 0 ? (
          <EmptyState icon={Inbox} title="No addresses yet" body="Ask your admin to register them." />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Search} title="No addresses match" body="Try another form of the address." />
        ) : (
          <>
            <DataTable<ProjectAddress>
              caption="Tracked addresses"
              rows={current.rows}
              rowKey={(row) => row.address}
              columns={[
                { key: "address", header: "Address", cell: (row) => <AddressChip address={row.address} href={txHref(row.address)} /> },
                { key: "state", header: "State", cell: (row) => <AddressStatusPill status={addressStatus(row)} /> },
                { key: "start", header: "Start lt", cell: (row) => (row.startLt === null ? <span className="text-ink-2">pending</span> : <LtText lt={row.startLt} />) },
                { key: "last", header: "Last lt", cell: (row) => <LtText lt={row.lastLt} /> },
                {
                  key: "open",
                  header: "Transactions",
                  className: "text-right",
                  cell: (row) => (
                    <Link href={txHref(row.address)} className="btn btn-secondary" aria-label={`View transactions of ${friendly(row.address)}`}>
                      View
                      <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
                    </Link>
                  ),
                },
              ]}
            />
            <Pagination page={current.page} pageCount={current.pageCount} onPage={setPage} label="Address pages" />
          </>
        )}
      </Card>
    </>
  );
}
