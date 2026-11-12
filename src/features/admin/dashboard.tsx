"use client";

import { FolderKanban, FolderOpen, Inbox, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { BarChartView } from "@/components/charts/bar-chart-card";
import { RelativeTime } from "@/components/chain/values";
import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink, Card, CardHeader, DataTable, EmptyState, ErrorState, KpiCard, SkeletonRows } from "@/components/ui";
import { projectsPerMonth } from "@/lib/chart";
import { errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import { compactNumber, exactNumber } from "@/lib/format";
import type { ProjectSummary } from "@/lib/types";
import { useProjects } from "./hooks";
import { ProjectCell } from "./project-cell";

export function AdminDashboard() {
  const { data, isLoading, error, refetch } = useProjects();
  const projects = useMemo(() => data ?? [], [data]);
  const linked = projects.reduce((sum, project) => sum + project.activeAccounts, 0);
  const empty = projects.filter((project) => project.activeAccounts === 0).length;
  const months = useMemo(() => projectsPerMonth(projects.map((project) => project.createdAt)), [projects]);
  const recent = useMemo(
    () => [...projects].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    [projects],
  );
  const failed = error ? errorText({ code: errorCode(error) }) : null;

  return (
    <>
      <PageHeader title="Dashboard" crumbs={[{ label: "Dashboard" }]} />
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard icon={FolderKanban} label="Total projects" loading={isLoading} value={failed ? "—" : compactNumber(projects.length)} title={exactNumber(projects.length)} />
        <KpiCard icon={Wallet} label="Linked addresses" loading={isLoading} value={failed ? "—" : compactNumber(linked)} title={exactNumber(linked)} />
        <KpiCard icon={FolderOpen} label="Projects without addresses" loading={isLoading} value={failed ? "—" : compactNumber(empty)} title={exactNumber(empty)} />
      </div>

      <Card className="mt-6" aria-labelledby="chart-title">
        <CardHeader title="Projects created per month" titleId="chart-title" subtitle="UTC months, up to the last 12" />
        {isLoading ? (
          <SkeletonRows rows={4} columns={1} />
        ) : failed ? (
          <ErrorState message={failed} onRetry={() => void refetch()} />
        ) : months.length === 0 ? (
          <EmptyState icon={Inbox} title="No projects yet" body="The chart fills in once projects exist." />
        ) : (
          <BarChartView data={months.map((month) => ({ label: month.label, value: month.count }))} valueLabel="Projects created" />
        )}
      </Card>

      <Card className="mt-6" aria-labelledby="recent-title">
        <CardHeader
          title="Recent projects"
          titleId="recent-title"
          subtitle="The five newest projects"
          actions={
            projects.length > 0 ? (
              <Link href="/admin/projects" className="link font-medium">
                View all projects →
              </Link>
            ) : null
          }
        />
        {isLoading ? (
          <SkeletonRows rows={5} columns={3} />
        ) : failed ? (
          <ErrorState message={failed} onRetry={() => void refetch()} />
        ) : recent.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No projects yet"
            body="Create a project to get its API key and register addresses."
            action={
              <ButtonLink href="/admin/projects/new" variant="primary">
                Create project
              </ButtonLink>
            }
          />
        ) : (
          <DataTable<ProjectSummary>
            caption="Recent projects"
            rows={recent}
            rowKey={(row) => row.id}
            columns={[
              { key: "name", header: "Project", cell: (row) => <ProjectCell id={row.id} name={row.name} /> },
              { key: "addresses", header: "Addresses", cell: (row) => <span className="num">{exactNumber(row.activeAccounts)}</span> },
              { key: "created", header: "Created", cell: (row) => <RelativeTime iso={row.createdAt} /> },
            ]}
          />
        )}
      </Card>
    </>
  );
}
