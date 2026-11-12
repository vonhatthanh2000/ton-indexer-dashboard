"use client";

import { Eye, Inbox, KeyRound, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RelativeTime } from "@/components/chain/values";
import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink, Card, CardHeader, CopyButton, DataTable, EmptyState, ErrorState, Menu, Pagination, SkeletonRows } from "@/components/ui";
import { errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import { exactNumber, shorten } from "@/lib/format";
import { filterBy, paginate } from "@/lib/paging";
import type { ProjectSummary } from "@/lib/types";
import { useProjects } from "./hooks";
import { ProjectCell } from "./project-cell";
import { RotateKeyFlow } from "./rotate-key";

const PAGE_SIZE = 10;

export function ProjectsPage() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useProjects();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rotating, setRotating] = useState<ProjectSummary | null>(null);
  const filtered = useMemo(() => filterBy(data ?? [], query, (row) => [row.name]), [data, query]);
  const current = paginate(filtered, page, PAGE_SIZE);

  return (
    <>
      <PageHeader title="Projects" crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Projects" }]} />
      <Card aria-labelledby="projects-title">
        <CardHeader
          title="Projects"
          titleId="projects-title"
          subtitle={data ? `${exactNumber(data.length)} in total` : "Every project registered in ton-observer"}
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
                  placeholder="Search by name"
                  aria-label="Search projects by name"
                  className="input pl-10"
                />
              </div>
              <ButtonLink href="/admin/projects/new" variant="primary">
                <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
                Create project
              </ButtonLink>
            </>
          }
        />
        {isLoading ? (
          <SkeletonRows rows={6} columns={5} />
        ) : error ? (
          <ErrorState message={errorText({ code: errorCode(error) })} onRetry={() => void refetch()} />
        ) : (data ?? []).length === 0 ? (
          <EmptyState icon={Inbox} title="No projects yet" body="Create a project to get its API key and register addresses." />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Search} title="No projects match" body={`Nothing is named like “${query.trim()}”.`} />
        ) : (
          <>
            <DataTable<ProjectSummary>
              caption="Projects"
              rows={current.rows}
              rowKey={(row) => row.id}
              columns={[
                { key: "name", header: "Project", cell: (row) => <ProjectCell id={row.id} name={row.name} /> },
                {
                  key: "id",
                  header: "Project ID",
                  cell: (row) => (
                    <span className="inline-flex items-center gap-1">
                      <span className="mono" title={row.id}>
                        {shorten(row.id, 8, 4)}
                      </span>
                      <CopyButton value={row.id} label="Copy project ID" />
                    </span>
                  ),
                },
                { key: "addresses", header: "Addresses", cell: (row) => <span className="num">{exactNumber(row.activeAccounts)}</span> },
                { key: "created", header: "Created", cell: (row) => <RelativeTime iso={row.createdAt} /> },
                {
                  key: "actions",
                  header: "Actions",
                  className: "w-16 text-right",
                  cell: (row) => (
                    <Menu
                      label={`Actions for ${row.name}`}
                      actions={[
                        { label: "View addresses", icon: Eye, onSelect: () => router.push(`/admin/projects/${row.id}`) },
                        { label: "Rotate API key", icon: KeyRound, onSelect: () => setRotating(row) },
                      ]}
                    />
                  ),
                },
              ]}
            />
            <Pagination page={current.page} pageCount={current.pageCount} onPage={setPage} label="Projects pages" />
          </>
        )}
      </Card>
      <RotateKeyFlow project={rotating} onClose={() => setRotating(null)} />
    </>
  );
}
