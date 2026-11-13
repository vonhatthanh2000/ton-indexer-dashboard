"use client";

import { ArrowRight, Inbox, Plus, Unlink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AddressChip } from "@/components/chain/address-chip";
import { AddressStatusPill, addressStatus } from "@/components/chain/status-pills";
import { LtText } from "@/components/chain/values";
import { PageHeader } from "@/components/shell/page-header";
import { Button, Card, CardHeader, DataTable, Dialog, EmptyState, ErrorState, Pill, PrevNext, SkeletonRows, Tooltip } from "@/components/ui";
import { errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import { hasNextPage } from "@/lib/paging";
import { can } from "@/lib/roles";
import type { AdminAddress } from "@/lib/types";
import { NoAddressesYet } from "./dashboard";
import { ADDRESS_PAGE_SIZE, useAddressPage, useOnRoleDenied, useUnlinkAddress } from "./hooks";
import { RegisterAddressesDialog } from "./register-dialog";
import { useProjectScope } from "./scope";
import { friendly, projectBase, txHref } from "./tx-parts";

/** `/projects/[id]/addresses`: server pages of 100; owners and editors register and unlink. */
export function AddressesPage() {
  const { projectId, projectName, role } = useProjectScope();
  const canWrite = can(role, "writeAddresses");
  const [offset, setOffset] = useState(0);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [unlinking, setUnlinking] = useState<AdminAddress | null>(null);
  const query = useAddressPage(projectId, offset);
  const unlink = useUnlinkAddress(projectId, offset);
  const onRoleDenied = useOnRoleDenied();
  const rows = query.data?.addresses ?? [];
  const syncing = rows.some((row) => row.stillSyncing);

  function confirmUnlink() {
    if (!unlinking) return;
    const address = unlinking.address;
    setUnlinking(null);
    unlink.mutate(address, {
      onSuccess: () => toast.success("Address unlinked."),
      onError: (caught) => {
        onRoleDenied(caught);
        toast.error(errorText({ code: errorCode(caught) }));
      },
    });
  }

  const registerButton = canWrite ? (
    <Button variant="primary" onClick={() => setRegisterOpen(true)}>
      <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
      Register addresses
    </Button>
  ) : null;

  return (
    <>
      <PageHeader title="Addresses" crumbs={[{ label: projectName, href: projectBase(projectId) }, { label: "Addresses" }]} />
      <Card aria-labelledby="addresses-title">
        <CardHeader
          title="Addresses"
          titleId="addresses-title"
          subtitle={
            syncing
              ? "History is still syncing for some addresses. This page refreshes every 10 seconds."
              : `Addresses ${projectName} indexes, with their sync state`
          }
          actions={query.isSuccess ? registerButton : null}
        />
        {query.isLoading ? (
          <SkeletonRows rows={5} columns={5} />
        ) : query.error ? (
          <ErrorState message={errorText({ code: errorCode(query.error) })} onRetry={() => void query.refetch()} />
        ) : rows.length === 0 && offset === 0 ? (
          canWrite ? (
            <EmptyState
              icon={Inbox}
              title="No addresses yet"
              body="Register the addresses this project should index."
              action={
                <Button variant="primary" onClick={() => setRegisterOpen(true)}>
                  Register addresses
                </Button>
              }
            />
          ) : (
            <NoAddressesYet projectId={projectId} canWrite={false} />
          )
        ) : rows.length === 0 ? (
          <>
            <EmptyState icon={Inbox} title="No more addresses" />
            <PrevNext
              label="Address pages"
              hasPrevious={offset > 0}
              hasNext={false}
              onPrevious={() => setOffset(Math.max(0, offset - ADDRESS_PAGE_SIZE))}
              onNext={() => {}}
            />
          </>
        ) : (
          <>
            <DataTable<AdminAddress>
              caption={`Addresses of ${projectName}`}
              rows={rows}
              rowKey={(row) => row.address}
              columns={[
                { key: "address", header: "Address", cell: (row) => <AddressChip address={row.address} href={txHref(projectId, row.address)} /> },
                { key: "state", header: "State", cell: (row) => <AddressStatusPill status={addressStatus(row)} /> },
                { key: "start", header: "Start lt", cell: (row) => (row.startLt === null ? <span className="text-ink-2">pending</span> : <LtText lt={row.startLt} />) },
                { key: "last", header: "Last lt", cell: (row) => <LtText lt={row.lastLt} /> },
                {
                  key: "error",
                  header: "Last error",
                  cell: (row) =>
                    row.lastError ? (
                      <Tooltip content={row.lastError}>
                        <span tabIndex={0} aria-label={`Error: ${row.lastError}`}>
                          <Pill tone="err" dot>
                            Error
                          </Pill>
                        </span>
                      </Tooltip>
                    ) : (
                      <span className="text-ink-2">—</span>
                    ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  className: "text-right",
                  cell: (row) => (
                    <span className="inline-flex flex-wrap justify-end gap-2">
                      <Link href={txHref(projectId, row.address)} className="btn btn-secondary" aria-label={`View transactions of ${friendly(row.address)}`}>
                        View
                        <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
                      </Link>
                      {canWrite ? (
                        <Button onClick={() => setUnlinking(row)} aria-label={`Unlink ${friendly(row.address)}`}>
                          <Unlink size={16} strokeWidth={1.5} aria-hidden="true" />
                          Unlink
                        </Button>
                      ) : null}
                    </span>
                  ),
                },
              ]}
            />
            <PrevNext
              label="Address pages"
              hasPrevious={offset > 0}
              hasNext={hasNextPage(rows.length, ADDRESS_PAGE_SIZE)}
              onPrevious={() => setOffset(Math.max(0, offset - ADDRESS_PAGE_SIZE))}
              onNext={() => setOffset(offset + ADDRESS_PAGE_SIZE)}
            />
          </>
        )}
      </Card>

      {canWrite ? (
        <>
          <RegisterAddressesDialog projectId={projectId} open={registerOpen} onOpenChange={setRegisterOpen} />
          <Dialog
            open={unlinking !== null}
            onOpenChange={(open) => (open ? undefined : setUnlinking(null))}
            title="Unlink this address?"
            description={
              <>
                <span className="mono break-all text-ink">{unlinking ? friendly(unlinking.address) : ""}</span> stops
                being part of {projectName}. Its data stays in the indexer.
              </>
            }
            footer={
              <>
                <Button onClick={() => setUnlinking(null)}>Cancel</Button>
                <Button variant="danger" onClick={confirmUnlink}>
                  Unlink address
                </Button>
              </>
            }
          />
        </>
      ) : null}
    </>
  );
}
