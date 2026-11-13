"use client";

import { ChevronDown, Inbox, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { AddressChip } from "@/components/chain/address-chip";
import { HashChip } from "@/components/chain/hash-chip";
import { TxStatusPill } from "@/components/chain/status-pills";
import { LtText, RelativeTime, TonAmount } from "@/components/chain/values";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader, EmptyState, ErrorState, LoadMore, Select, SkeletonRows } from "@/components/ui";
import { errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import { shorten } from "@/lib/format";
import { can } from "@/lib/roles";
import { toRaw } from "@/lib/ton";
import type { Transaction } from "@/lib/types";
import { NoAddressesYet } from "./dashboard";
import { useProject, useProjectTransactions, useTransactions } from "./hooks";
import { useProjectScope } from "./scope";
import { FlowCell, Opcode, friendly, projectBase, txHref } from "./tx-parts";

function rawOf(address: string | null): string | null {
  if (!address) return null;
  try {
    return toRaw(address);
  } catch {
    return null;
  }
}

function matches(tx: Transaction, needle: string): boolean {
  if (!needle) return true;
  const values = [tx.hash, tx.account, tx.sender, ...tx.outMsgs.map((message) => message.destination)];
  return values.some((value) => {
    if (!value) return false;
    if (value.toLowerCase().includes(needle)) return true;
    return friendly(value).toLowerCase().includes(needle);
  });
}

export function TransactionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { projectId, projectName, role } = useProjectScope();
  const project = useProject(projectId);
  const addresses = useMemo(() => project.data?.addresses ?? [], [project.data]);
  const requested = rawOf(params.get("address"));
  // No (or an unknown) ?address= means every address at once.
  const selected = addresses.find((row) => row.address === requested)?.address ?? null;
  const requestedUnknown = Boolean(params.get("address")) && project.isSuccess && selected === null;
  const all = useProjectTransactions(projectId, project.isSuccess && addresses.length > 0 && selected === null);
  const one = useTransactions(projectId, selected ?? undefined);
  const tx = selected ? one : all;
  const live = tx.data?.pages.length === 1;
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rows = useMemo(() => tx.data?.pages.flat() ?? [], [tx.data]);
  const needle = query.trim().toLowerCase();
  const visible = rows.filter((row) => matches(row, needle));
  const txError = tx.error ? errorText({ code: errorCode(tx.error) }) : null;

  function select(address: string) {
    setExpanded(new Set());
    setQuery("");
    router.replace(address ? `${pathname}?address=${encodeURIComponent(friendly(address))}` : pathname);
  }

  function toggle(hash: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  }

  return (
    <>
      <PageHeader title="Transactions" crumbs={[{ label: projectName, href: projectBase(projectId) }, { label: "Transactions" }]} />
      <Card aria-labelledby="tx-title">
        <CardHeader
          title="Transactions"
          titleId="tx-title"
          subtitle={`${selected ? "Newest first for one address" : "Newest first across every address"}. ${
            live ? "Updates every 5 seconds." : "Live updates pause while older pages are loaded."
          }`}
          actions={
            addresses.length > 0 ? (
              <>
                <div className="w-72 max-w-full">
                  <label htmlFor="tx-address" className="sr-only">
                    Address
                  </label>
                  <Select id="tx-address" className="mono" value={selected ?? ""} onChange={(event) => select(event.target.value)}>
                    <option value="">All addresses</option>
                    {addresses.map((row) => (
                      <option key={row.address} value={row.address}>
                        {shorten(friendly(row.address), 8, 6)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="relative w-64 max-w-full">
                  <Search size={16} strokeWidth={1.5} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-2" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Hash or address"
                    aria-label="Search loaded transactions by hash or address"
                    className="input pl-10"
                  />
                </div>
              </>
            ) : null
          }
        />
        {requestedUnknown ? (
          <p role="alert" className="mb-4 rounded-control bg-err-soft px-4 py-3 text-err">
            {errorText({ code: "FORBIDDEN" })} Showing all addresses instead.
          </p>
        ) : null}
        {project.isLoading || tx.isLoading ? (
          <SkeletonRows rows={6} columns={6} />
        ) : project.error ? (
          <ErrorState message={errorText({ code: errorCode(project.error) })} onRetry={() => void project.refetch()} />
        ) : addresses.length === 0 ? (
          <NoAddressesYet projectId={projectId} canWrite={can(role, "writeAddresses")} />
        ) : txError && rows.length === 0 ? (
          <ErrorState message={txError} onRetry={() => void tx.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Inbox} title="No transactions stored yet" body="History may still be syncing." />
        ) : (
          <>
            {selected ? (
              <p className="mb-2 flex flex-wrap items-center gap-2 text-ink-2">
                Showing <AddressChip address={selected} />
              </p>
            ) : null}
            <div className="table-scroll">
              <table className="data-table">
                <caption className="sr-only">{selected ? `Transactions of ${friendly(selected)}` : `Transactions of every address in ${projectName}`}</caption>
                <thead>
                  <tr>
                    {selected ? null : <th scope="col">Address</th>}
                    <th scope="col">Tx hash</th>
                    <th scope="col">Time</th>
                    <th scope="col">From → Out</th>
                    <th scope="col">Value</th>
                    <th scope="col">Fee</th>
                    <th scope="col">Opcode</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const rowKey = `${row.account}-${row.hash}`;
                    const open = expanded.has(rowKey);
                    const detailId = `tx-${row.account.replace(/[^0-9A-Za-z]/g, "")}-${row.lt}`;
                    return (
                      <Fragment key={rowKey}>
                        <tr>
                          {selected ? null : (
                            <td><AddressChip address={row.account} href={txHref(projectId, row.account)} /></td>
                          )}
                          <td><HashChip hash={row.hash} /></td>
                          <td><RelativeTime iso={row.time} /></td>
                          <td><FlowCell tx={row} /></td>
                          <td><TonAmount nano={row.value} /></td>
                          <td><TonAmount nano={row.fee} /></td>
                          <td><Opcode value={row.inMsgOpcode} /></td>
                          <td><TxStatusPill aborted={row.aborted} /></td>
                          <td className="text-right">
                            <button
                              type="button"
                              className="btn btn-secondary btn-icon border-0"
                              aria-expanded={open}
                              aria-controls={detailId}
                              aria-label={open ? "Hide details" : "Show details"}
                              onClick={() => toggle(rowKey)}
                            >
                              <ChevronDown size={18} strokeWidth={1.5} className={open ? "rotate-180" : undefined} />
                            </button>
                          </td>
                        </tr>
                        {open ? (
                          <tr id={detailId}>
                            <td colSpan={selected ? 8 : 9} className="bg-surface-2">
                              <TxDetail tx={row} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {visible.length === 0 ? <p className="py-6 text-center text-ink-2">No loaded transaction matches “{query.trim()}”.</p> : null}
            {txError ? (
              <p role="alert" className="mt-4 text-center text-err">
                {txError}
              </p>
            ) : null}
            {tx.hasNextPage ? (
              <LoadMore onClick={() => void tx.fetchNextPage()} loading={tx.isFetchingNextPage} disabled={false} />
            ) : (
              <p className="mt-5 text-center text-ink-2">No older transactions.</p>
            )}
          </>
        )}
      </Card>
    </>
  );
}

function TxDetail({ tx }: { tx: Transaction }) {
  return (
    <div className="grid gap-4 py-3 md:grid-cols-3">
      <dl className="grid gap-2">
        <div>
          <dt className="text-label text-ink-2">Logical time</dt>
          <dd><LtText lt={tx.lt} /></dd>
        </div>
        <div>
          <dt className="text-label text-ink-2">Trace id</dt>
          <dd className="mono break-all">{tx.traceId ?? "—"}</dd>
        </div>
      </dl>
      <div className="md:col-span-2">
        <p className="text-label text-ink-2">Out messages ({tx.outMsgs.length})</p>
        {tx.outMsgs.length === 0 ? (
          <p className="mt-1 text-ink-2">None</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-2">
            {tx.outMsgs.map((message, index) => (
              <li key={index} className="flex flex-wrap items-center gap-x-6 gap-y-1">
                {message.destination ? <AddressChip address={message.destination} /> : <span className="text-ink-2">external out</span>}
                <TonAmount nano={message.value} />
                <Opcode value={message.opcode} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
