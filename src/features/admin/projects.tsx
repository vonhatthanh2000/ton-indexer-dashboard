"use client";

import { FolderPlus, Inbox, Pencil, Search, Trash2, UserCog } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { Identicon } from "@/components/chain/identicon";
import { Menu } from "@/components/ui/menu";
import { RelativeTime } from "@/components/chain/values";
import { PageHeader } from "@/components/shell/page-header";
import { Button, ButtonLink, Card, CardHeader, DataTable, Dialog, EmptyState, ErrorState, Field, Input, Pagination, Pill, SkeletonRows } from "@/components/ui";
import { notifyInvite } from "@/features/members/invite-toast";
import { ApiError, errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import { exactNumber } from "@/lib/format";
import { filterBy, paginate } from "@/lib/paging";
import type { AdminProject } from "@/lib/types";
import { useAdminProjects, useCreateProject } from "./hooks";
import { DeleteProjectDialog, RenameProjectDialog, type ProjectRef } from "./project-actions";
import { validateProjectName } from "./project-name";

export { validateProjectName };

const PAGE_SIZE = 10;
type FieldName = "name" | "ownerEmail";
type FormError = { field?: FieldName; text: string };

function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateProject();
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [error, setError] = useState<FormError | null>(null);

  function close(next: boolean) {
    if (!next) {
      setName("");
      setOwnerEmail("");
      setError(null);
      create.reset();
    }
    onOpenChange(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = validateProjectName(name);
    if (problem) return setError({ field: "name", text: problem });
    const email = ownerEmail.trim();
    if (!email) return setError({ field: "ownerEmail", text: "Enter the owner's email address." });
    setError(null);
    try {
      const reply = await create.mutateAsync({ name: name.trim(), ownerEmail: email });
      notifyInvite(reply.project.id, reply.owner.userId, reply.invite, `Project ${reply.project.name} created. Invite sent to ${reply.owner.email}.`);
      close(false);
    } catch (caught) {
      if (caught instanceof ApiError) {
        const text = errorText({ code: caught.code, field: caught.field, index: caught.index, problem: caught.problem });
        const field: FieldName | undefined =
          caught.code === "project_exists" ? "name" : caught.field === "name" || caught.field === "ownerEmail" ? caught.field : undefined;
        setError({ field, text });
      } else {
        setError({ text: errorText({ code: errorCode(caught) }) });
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="New project"
      description="The owner gets an invite email. They add addresses and members and generate the API key."
      footer={
        <>
          <Button onClick={() => close(false)}>Cancel</Button>
          <Button type="submit" form="new-project-form" variant="primary" busy={create.isPending}>
            Create project
          </Button>
        </>
      }
    >
      <form id="new-project-form" onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Field label="Project name" hint="1 to 64 characters, unique." error={error?.field === "name" ? error.text : undefined}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
              maxLength={200}
            />
          )}
        </Field>
        <Field label="Owner email" error={error?.field === "ownerEmail" ? error.text : undefined}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              autoComplete="off"
              value={ownerEmail}
              onChange={(event) => setOwnerEmail(event.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
        {error && !error.field ? (
          <p className="field-error mt-0" role="alert">
            {error.text}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

function ProjectCell({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/projects/${encodeURIComponent(id)}`} className="inline-flex min-w-0 items-center gap-3 font-medium">
      <Identicon seed={id} size={32} />
      <span className="link truncate text-ink">{name}</span>
    </Link>
  );
}

/** `/admin`: every project, and "New project". */
export function AdminProjects() {
  const { data, isLoading, error, refetch } = useAdminProjects();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<ProjectRef | null>(null);
  const [deleting, setDeleting] = useState<ProjectRef | null>(null);
  const filtered = useMemo(
    () => filterBy(data ?? [], query, (row) => [row.name, ...row.owners.map((owner) => owner.email)]),
    [data, query],
  );
  const current = paginate(filtered, page, PAGE_SIZE);

  return (
    <>
      <PageHeader title="Admin" crumbs={[{ label: "Admin" }]} />
      <Card aria-labelledby="projects-title">
        <CardHeader
          title="All projects"
          titleId="projects-title"
          subtitle={data ? `${exactNumber(data.length)} in total` : "Every project on this server"}
          actions={
            <>
              <div className="relative w-64 max-w-full">
                <Search size={16} strokeWidth={1.5} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-2" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by name or owner"
                  aria-label="Search projects by name or owner"
                  className="input pl-10"
                />
              </div>
              <ButtonLink href="/admin/users">
                <UserCog size={18} strokeWidth={1.5} aria-hidden="true" />
                Admin users
              </ButtonLink>
              <Button variant="primary" onClick={() => setCreating(true)}>
                <FolderPlus size={18} strokeWidth={1.75} aria-hidden="true" />
                New project
              </Button>
            </>
          }
        />
        {isLoading ? (
          <SkeletonRows rows={6} columns={5} />
        ) : error ? (
          <ErrorState message={errorText({ code: errorCode(error) })} onRetry={() => void refetch()} />
        ) : (data ?? []).length === 0 ? (
          <EmptyState icon={Inbox} title="No projects yet" body="Create a project and give it an owner." />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Search} title="No projects match" body={`No project name or owner contains “${query.trim()}”.`} />
        ) : (
          <>
            <DataTable<AdminProject>
              caption="All projects"
              rows={current.rows}
              rowKey={(row) => row.id}
              columns={[
                { key: "name", header: "Project", cell: (row) => <ProjectCell id={row.id} name={row.name} /> },
                {
                  key: "owners",
                  header: "Owners",
                  cell: (row) =>
                    row.owners.length === 0 ? (
                      <span className="text-ink-2">No owner</span>
                    ) : (
                      <span className="flex flex-col">
                        {row.owners.map((owner) => (
                          <span key={owner.userId} className="break-all">
                            {owner.email}
                          </span>
                        ))}
                      </span>
                    ),
                },
                { key: "addresses", header: "Addresses", cell: (row) => <span className="num">{exactNumber(row.activeAccounts)}</span> },
                {
                  key: "key",
                  header: "API key",
                  cell: (row) => (row.hasApiKey ? <Pill tone="ok">Issued</Pill> : <Pill tone="neutral">None</Pill>),
                },
                { key: "created", header: "Created", cell: (row) => <RelativeTime iso={row.createdAt} /> },
                {
                  key: "actions",
                  header: "Actions",
                  cell: (row) => (
                    <div className="text-right">
                      <Menu
                        label={`Actions for ${row.name}`}
                        actions={[
                          { label: "Rename", icon: Pencil, onSelect: () => setRenaming({ id: row.id, name: row.name }) },
                          { label: "Delete", icon: Trash2, onSelect: () => setDeleting({ id: row.id, name: row.name }) },
                        ]}
                      />
                    </div>
                  ),
                },
              ]}
            />
            <Pagination page={current.page} pageCount={current.pageCount} onPage={setPage} label="Projects pages" />
          </>
        )}
      </Card>
      <NewProjectDialog open={creating} onOpenChange={setCreating} />
      {renaming ? (
        <RenameProjectDialog key={`rename-${renaming.id}`} project={renaming} open onOpenChange={(open) => !open && setRenaming(null)} />
      ) : null}
      {deleting ? (
        <DeleteProjectDialog key={`delete-${deleting.id}`} project={deleting} open onOpenChange={(open) => !open && setDeleting(null)} />
      ) : null}
    </>
  );
}
