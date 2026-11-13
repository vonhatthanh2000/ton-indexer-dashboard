"use client";

import { ShieldPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Button, Card, CardHeader, Field, Input } from "@/components/ui";
import { ApiError, errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import { useAddAdmin } from "./hooks";

/** `/admin/users`: make someone an admin. A new email gets an account; an existing user is promoted. */
export function AdminUsers() {
  const addAdmin = useAddAdmin();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<{ field?: "email"; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return setError({ field: "email", text: "Enter an email address." });
    setError(null);
    try {
      // 201 (a new account) and 200 (an existing user) both mean the email is now an admin.
      const reply = await addAdmin.mutateAsync(trimmed);
      toast.success(`${reply.user.email} is now an admin.`);
      setEmail("");
    } catch (caught) {
      if (caught instanceof ApiError) {
        const text = errorText({ code: caught.code, field: caught.field, index: caught.index, problem: caught.problem });
        setError({ field: caught.field === "email" ? "email" : undefined, text });
      } else {
        setError({ text: errorText({ code: errorCode(caught) }) });
      }
    }
  }

  return (
    <>
      <PageHeader title="Admin users" crumbs={[{ label: "Admin", href: "/admin" }, { label: "Admin users" }]} />
      <Card className="max-w-2xl" aria-labelledby="add-admin-title">
        <CardHeader
          title="Add an admin"
          titleId="add-admin-title"
          subtitle="Admins see every project, create projects and add owners. Someone without an account gets one and signs in with Google or a password."
        />
        <form onSubmit={submit} noValidate>
          <Field label="Email" error={error?.field === "email" ? error.text : undefined}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="email"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            {error && !error.field ? (
              <p className="mr-auto text-err" role="alert">
                {error.text}
              </p>
            ) : null}
            <Button type="submit" variant="primary" busy={addAdmin.isPending}>
              <ShieldPlus size={18} strokeWidth={1.5} aria-hidden="true" />
              Add admin
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
