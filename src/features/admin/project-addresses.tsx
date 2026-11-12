"use client";

import { Inbox, Plus, SearchX, Unlink } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { toFriendly } from "@/lib/ton";
import type { AdminAddress } from "@/lib/types";
import { ADDRESS_PAGE_SIZE, useProjectAddresses, useProjects, useUnlinkAddress } from "./hooks";
import { ProjectKeyPrompt } from "./project-key-prompt";
import { RegisterAddressesDrawer } from "./register-drawer";
import { RotateKeyFlow } from "./rotate-key";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function friendly(address: string): string {
  try {
    return toFriendly(address);
  } catch {
    return address;
  }
}

export function ProjectAddressesPage({ projectId }: { projectId: string }) {
  const projects = useProjects();
  const project = projects.data?.find((row) => row.id === projectId);
  const crumbs = [
    { label: "Dashboard", href: "/admin" },
    { label: "Projects", href: "/admin/projects" },
    { label: project?.name ?? "Project" },
  ];

  if (projects.isLoading) {
    return (
      <>
        <PageHeader title="Project" crumbs={crumbs} />
        <Card>
          <SkeletonRows rows={5} columns={4} />
        </Card>
      </>
    );
  }
  if (projects.error) {
    return (
      <>
        <PageHeader title="Project" crumbs={crumbs} />
        <Card>
          <ErrorState message={errorText({ code: errorCode(projects.error) })} onRetry={() => void projects.refetch()} />
        </Card>
      </>
    );
  }
  if (!UUID.test(projectId) || !project) {
    return (
      <>
        <PageHeader title="Project not found" crumbs={crumbs} />
        <Card>
          <EmptyState
            icon={SearchX}
            title="Project not found"
            body="No project has this id. It may have a typo in the link."
            action={
              <Link href="/admin/projects" className="btn btn-secondary">
                Back to projects
              </Link>
            }
          />
        </Card>
      </>
    );
  }
  return <ProjectAddresses project={project} crumbs={crumbs} />;
}

function ProjectAddresses({
  project,
  crumbs,
}: {
  project: { id: string; name: string };
  crumbs: { label: string; href?: string }[];
}) {
  const params = useSearchParams();
  const [offset, setOffset] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unlinking, setUnlinking] = useState<AdminAddress | null>(null);
  const [rotating, setRotating] = useState(false);
  const query = useProjectAddresses(project.id, offset);
  const unlink = useUnlinkAddress(project.id, offset);
  const needsKey = errorCode(query.error) === "project_key_invalid";
  const rows = query.data?.addresses ?? [];

  // `?register=1` (from the key modal) opens the drawer once the addresses load.
  const [registerHandled, setRegisterHandled] = useState(false);
  const autoOpen = params.get("register") === "1" && query.isSuccess && !registerHandled;
  const isDrawerOpen = drawerOpen || autoOpen;
  function onDrawerChange(open: boolean) {
    setRegisterHandled(true);
    setDrawerOpen(open);
  }

  function confirmUnlink() {
    if (!unlinking) return;
    const address = unlinking.address;
    setUnlinking(null);
    unlink.mutate(address, {
      onSuccess: () => toast.success("Address unlinked."),
      onError: (caught) => toast.error(errorText({ code: errorCode(caught) })),
    });
  }

  return (
    <>
      <PageHeader title={project.name} crumbs={crumbs} />
      <Card aria-labelledby="addresses-title">
        <CardHeader
          title={`Addresses of ${project.name}`}
          titleId="addresses-title"
          subtitle="Addresses this project indexes, with their sync state"
          actions={
            query.isSuccess ? (
              <Button variant="primary" onClick={() => setDrawerOpen(true)}>
                <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
                Register addresses
              </Button>
            ) : null
          }
        />
        {query.isLoading ? (
          <SkeletonRows rows={5} columns={5} />
        ) : needsKey ? (
          <ProjectKeyPrompt projectId={project.id} onRotate={() => setRotating(true)} />
        ) : query.error ? (
          <ErrorState message={errorText({ code: errorCode(query.error) })} onRetry={() => void query.refetch()} />
        ) : rows.length === 0 && offset === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No addresses yet"
            body="Register the addresses this project should index."
            action={
              <Button variant="primary" onClick={() => setDrawerOpen(true)}>
                Register addresses
              </Button>
            }
          />
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
              caption={`Addresses of ${project.name}`}
              rows={rows}
              rowKey={(row) => row.address}
              columns={[
                { key: "address", header: "Address", cell: (row) => <AddressChip address={row.address} /> },
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
                    <Button onClick={() => setUnlinking(row)} aria-label={`Unlink ${friendly(row.address)}`}>
                      <Unlink size={16} strokeWidth={1.5} aria-hidden="true" />
                      Unlink
                    </Button>
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

      <RegisterAddressesDrawer projectId={project.id} open={isDrawerOpen} onOpenChange={onDrawerChange} />
      <Dialog
        open={unlinking !== null}
        onOpenChange={(open) => (open ? undefined : setUnlinking(null))}
        title="Unlink this address?"
        description={
          <>
            <span className="mono break-all text-ink">{unlinking ? friendly(unlinking.address) : ""}</span> stops being
            part of {project.name}. Its data stays in the indexer.
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
      <RotateKeyFlow project={rotating ? project : null} onClose={() => setRotating(false)} />
    </>
  );
}
