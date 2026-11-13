"use client";

import { KeyRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { NetworkPill } from "@/components/chain/values";
import { PageHeader } from "@/components/shell/page-header";
import { Button, Card, CardHeader, CopyButton, Dialog, RolePill } from "@/components/ui";
import { errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import { can } from "@/lib/roles";
import { ApiKeyModal } from "./api-key-modal";
import { useIssueApiKey, useOnRoleDenied } from "./hooks";
import { useProjectScope } from "./scope";
import { projectBase } from "./tx-parts";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line py-4 last:border-b-0 sm:grid-cols-3 sm:gap-6">
      <dt className="text-ink-2">{label}</dt>
      <dd className="min-w-0 sm:col-span-2">{children}</dd>
    </div>
  );
}

/** Confirm, generate, then show the key once. */
function GenerateApiKey({ projectId, projectName }: { projectId: string; projectName: string }) {
  const issue = useIssueApiKey(projectId);
  const onRoleDenied = useOnRoleDenied();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    issue.reset();
    setError(null);
    setConfirming(false);
  }

  return (
    <>
      <Button variant="primary" onClick={() => setConfirming(true)}>
        <KeyRound size={18} strokeWidth={1.5} aria-hidden="true" />
        Generate API key
      </Button>
      {issue.data ? (
        <ApiKeyModal
          open
          projectName={projectName}
          apiKey={issue.data.apiKey}
          onDone={() => {
            close();
            toast.success(`New API key issued for ${projectName}.`);
          }}
        />
      ) : (
        <Dialog
          open={confirming}
          onOpenChange={(open) => (open ? setConfirming(true) : close())}
          title="Generate a new API key?"
          description="Replaces any existing key; systems using the old key stop working."
          footer={
            <>
              <Button onClick={close}>Cancel</Button>
              <Button
                variant="danger"
                busy={issue.isPending}
                onClick={() =>
                  issue.mutate(undefined, {
                    onError: (caught) => {
                      onRoleDenied(caught);
                      setError(errorText({ code: errorCode(caught) }));
                    },
                  })
                }
              >
                {issue.isPending ? "Generating…" : "Generate API key"}
              </Button>
            </>
          }
        >
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
        </Dialog>
      )}
    </>
  );
}

/** `/projects/[id]/settings`: project info for everyone; owners generate the API key. */
export function ProjectSettings() {
  const { projectId, projectName, role, isAdmin } = useProjectScope();
  return (
    <>
      <PageHeader title="Settings" crumbs={[{ label: projectName, href: projectBase(projectId) }, { label: "Settings" }]} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card aria-labelledby="project-info">
          <CardHeader title="Project" titleId="project-info" subtitle="The project this workspace shows" />
          <dl>
            <Row label="Name">{projectName}</Row>
            <Row label="Project ID">
              <span className="inline-flex items-center gap-1">
                <span className="mono break-all">{projectId}</span>
                <CopyButton value={projectId} label="Copy project ID" />
              </span>
            </Row>
            <Row label="Network">
              <NetworkPill />
            </Row>
            <Row label="Your role">
              <RolePill role={role} />
            </Row>
          </dl>
        </Card>
        {can(role, "issueKey", isAdmin) ? (
          <Card aria-labelledby="api-key-title">
            <CardHeader
              title="API key"
              titleId="api-key-title"
              subtitle="Other systems read this project through the API with its key. It is shown once, when you generate it."
            />
            <GenerateApiKey projectId={projectId} projectName={projectName} />
          </Card>
        ) : null}
      </div>
    </>
  );
}
