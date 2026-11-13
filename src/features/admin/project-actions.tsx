"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button, Dialog, Field, Input } from "@/components/ui";
import { ApiError, errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import { useDeleteProject, useForgetProject, useRenameProject } from "./hooks";
import { validateProjectName } from "./project-name";

export interface ProjectRef {
  id: string;
  name: string;
}

function textOf(caught: unknown): string {
  if (caught instanceof ApiError) {
    return errorText({ code: caught.code, field: caught.field, index: caught.index, problem: caught.problem });
  }
  return errorText({ code: errorCode(caught) });
}

/** Admin rename: `PATCH /api/projects/:id {name}`. Only the name changes; links keep working. */
export function RenameProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const rename = useRenameProject();
  const [name, setName] = useState(project.name);
  const [error, setError] = useState<{ onField: boolean; text: string } | null>(null);

  function close(next: boolean) {
    if (next) setName(project.name);
    else {
      setError(null);
      rename.reset();
    }
    onOpenChange(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = validateProjectName(name);
    if (problem) return setError({ onField: true, text: problem });
    const next = name.trim();
    if (next === project.name) return close(false);
    setError(null);
    try {
      const reply = await rename.mutateAsync({ projectId: project.id, name: next });
      toast.success(`Project renamed to ${reply.project.name}.`);
      close(false);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "project_not_found") {
        toast.error("This project was already deleted. The list was refreshed.");
        close(false);
        return;
      }
      const onField = caught instanceof ApiError && (caught.code === "project_exists" || caught.field === "name");
      setError({ onField, text: textOf(caught) });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Rename project"
      description="Only the name changes. The project id, API key, members, addresses and transactions stay as they are."
      footer={
        <>
          <Button onClick={() => close(false)}>Cancel</Button>
          <Button type="submit" form="rename-project-form" variant="primary" busy={rename.isPending}>
            Rename
          </Button>
        </>
      }
    >
      <form id="rename-project-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Project name" hint="1 to 64 characters, unique." error={error?.onField ? error.text : undefined}>
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
        {error && !error.onField ? (
          <p className="field-error mt-0" role="alert">
            {error.text}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

/**
 * Admin delete: `DELETE /api/projects/:id`, after typing the project name. Leaves any open
 * `/projects/:id/…` page for `/admin` first, then drops the project from every cached list.
 */
export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const remove = useDeleteProject();
  const forget = useForgetProject();
  const router = useRouter();
  const pathname = usePathname();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const confirmed = typed === project.name;

  function close(next: boolean) {
    if (!next) {
      setTyped("");
      setError(null);
      remove.reset();
    }
    onOpenChange(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!confirmed) return setError("Type the project name exactly to confirm.");
    setError(null);
    try {
      const { alreadyGone } = await remove.mutateAsync(project.id);
      const base = `/projects/${encodeURIComponent(project.id)}`;
      const leaving = pathname === base || pathname.startsWith(`${base}/`);
      if (leaving) router.push("/admin");
      forget(project.id, { leaving });
      if (alreadyGone) toast.success(`${project.name} was already deleted.`);
      else toast.success(`Project ${project.name} deleted.`);
      close(false);
    } catch (caught) {
      setError(textOf(caught));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={`Delete ${project.name}?`}
      description="This can't be undone."
      footer={
        <>
          <Button onClick={() => close(false)}>Cancel</Button>
          <Button type="submit" form="delete-project-form" variant="danger" busy={remove.isPending} disabled={!confirmed}>
            Delete project
          </Button>
        </>
      }
    >
      <form id="delete-project-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-control bg-err-soft px-4 py-3">
            <p className="font-medium text-err">Removed</p>
            <p className="mt-1 text-ink">The project, its members, its address links and its API key. The key stops working at once.</p>
          </div>
          <div className="rounded-control bg-neutral-soft px-4 py-3">
            <p className="font-medium text-neutral-text">Kept</p>
            <p className="mt-1 text-ink">Addresses and their indexed transactions, because other projects may share them.</p>
          </div>
        </div>
        <Field label={`Type ${project.name} to confirm`} error={error ?? undefined}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}
