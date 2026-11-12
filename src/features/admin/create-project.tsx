"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Button, ButtonLink, Card, CardHeader, Field, Input } from "@/components/ui";
import { ApiError, errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import { ApiKeyModal } from "./api-key-modal";
import { useCreateProject } from "./hooks";

const MAX_NAME = 64;
const CONTROL = /\p{Cc}/u;

export function validateProjectName(value: string): string | null {
  const name = value.trim();
  if (!name) return "Name is required.";
  if (name.length > MAX_NAME) return `Name must be ${MAX_NAME} characters or fewer.`;
  if (CONTROL.test(name)) return "Name can't contain control characters.";
  return null;
}

export function CreateProjectPage() {
  const router = useRouter();
  const create = useCreateProject();
  const [name, setName] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    setStatus(null);
    const problem = validateProjectName(name);
    setFieldError(problem);
    if (problem) {
      inputRef.current?.focus();
      return;
    }
    create.mutate(name.trim(), {
      onError: (caught) => {
        const code = errorCode(caught);
        if (code === "project_exists" || (caught instanceof ApiError && caught.field === "name")) {
          setFieldError(
            errorText(caught instanceof ApiError ? { code, field: caught.field, problem: caught.problem } : { code }),
          );
          inputRef.current?.focus();
        } else {
          setStatus(errorText({ code }));
        }
      },
    });
  }

  const created = create.data;

  return (
    <>
      <PageHeader
        title="Create project"
        crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Projects", href: "/admin/projects" }, { label: "Create project" }]}
      />
      <Card className="max-w-2xl" aria-labelledby="create-title">
        <CardHeader title="New project" titleId="create-title" subtitle="You get its API key once, right after it is created." />
        <form onSubmit={submit} noValidate>
          <Field label="Project name" hint="1 to 64 characters, unique." error={fieldError ?? undefined}>
            {({ id, describedBy, invalid }) => (
              <Input
                ref={inputRef}
                id={id}
                name="name"
                autoComplete="off"
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-describedby={describedBy}
                invalid={invalid}
                maxLength={200}
              />
            )}
          </Field>
          <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
            <p role="status" className="mr-auto text-err">
              {status}
            </p>
            <ButtonLink href="/admin/projects">Cancel</ButtonLink>
            <Button type="submit" variant="primary" busy={create.isPending}>
              {create.isPending ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </Card>
      {created ? (
        <ApiKeyModal
          open
          projectName={created.project.name}
          apiKey={created.apiKey}
          onRegister={() => {
            const id = created.project.id;
            create.reset();
            router.push(`/admin/projects/${id}?register=1`);
          }}
          onDone={() => {
            const projectName = created.project.name;
            create.reset();
            toast.success(`Project ${projectName} created.`);
            router.push("/admin/projects");
          }}
        />
      ) : null}
    </>
  );
}
