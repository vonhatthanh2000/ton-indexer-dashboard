"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, LogOut } from "lucide-react";
import { NetworkPill } from "@/components/chain/values";
import { ApiStatusDot } from "@/components/shell/topbar";
import { PageHeader } from "@/components/shell/page-header";
import { Button, Card, CardHeader, CopyButton } from "@/components/ui";
import { signOut } from "./session-actions";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line py-4 last:border-b-0 sm:grid-cols-3 sm:gap-6">
      <dt className="text-ink-2">{label}</dt>
      <dd className="min-w-0 sm:col-span-2">{children}</dd>
    </div>
  );
}

export function SettingsView({
  role,
  apiHost,
  docsUrl,
  project,
}: {
  role: "admin" | "project";
  apiHost?: string;
  docsUrl?: string;
  project?: { id: string; name: string };
}) {
  const client = useQueryClient();
  const base = role === "admin" ? "/admin" : "/project";
  return (
    <>
      <PageHeader title="Settings" crumbs={[{ label: "Dashboard", href: base }, { label: "Settings" }]} />
      <div className="grid gap-6 xl:grid-cols-2">
        {role === "project" && project ? (
          <Card aria-labelledby="project-info">
            <CardHeader title="Project" titleId="project-info" subtitle="Read-only. Ask your admin to change it." />
            <dl>
              <Row label="Name">{project.name}</Row>
              <Row label="Project ID">
                <span className="inline-flex items-center gap-1">
                  <span className="mono break-all">{project.id}</span>
                  <CopyButton value={project.id} label="Copy project ID" />
                </span>
              </Row>
              <Row label="Network">
                <NetworkPill />
              </Row>
            </dl>
          </Card>
        ) : null}
        {role === "admin" ? (
          <Card aria-labelledby="api-info">
            <CardHeader title="API" titleId="api-info" subtitle="The ton-observer server this dashboard talks to" />
            <dl>
              <Row label="API host">
                <span className="mono">{apiHost}</span>
              </Row>
              <Row label="Status">
                <ApiStatusDot />
              </Row>
              <Row label="API reference">
                <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-2 font-medium">
                  Open the OpenAPI docs
                  <ExternalLink size={14} strokeWidth={1.5} aria-hidden="true" />
                </a>
              </Row>
            </dl>
          </Card>
        ) : null}
        <Card aria-labelledby="session-info">
          <CardHeader title="Session" titleId="session-info" subtitle="Your key is kept in an encrypted cookie for at most 12 hours." />
          <Button onClick={() => void signOut(client)}>
            <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />
            Sign out
          </Button>
        </Card>
      </div>
    </>
  );
}
