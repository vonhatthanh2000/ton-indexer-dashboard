"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Button, Card, CardHeader, Field, Input, Pill } from "@/components/ui";
import { ME_KEY, useMe } from "@/features/auth/use-me";
import { signOut } from "@/features/auth/sign-out";
import { ApiError, apiFetch, errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import type { Me } from "@/lib/types";
import { PASSWORD_MAX, PASSWORD_MIN, newPasswordProblem, passwordBody } from "./password";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line py-4 last:border-b-0 sm:grid-cols-3 sm:gap-6">
      <dt className="text-ink-2">{label}</dt>
      <dd className="min-w-0 sm:col-span-2">{children}</dd>
    </div>
  );
}

interface Errors {
  current?: string;
  next?: string;
  form?: string;
}

// A failed POST /auth/password: a field problem goes next to its field.
function failureErrors(caught: unknown): Errors {
  const code = errorCode(caught);
  if (code === "invalid_credentials") return { current: "The current password is wrong." };
  if (caught instanceof ApiError && code === "invalid_request") {
    const text = errorText({ code, field: caught.field, problem: caught.problem });
    if (caught.field === "currentPassword") return { current: text };
    if (caught.field === "newPassword") return { next: text };
    return { form: text };
  }
  return { form: errorText({ code }) };
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const client = useQueryClient();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Errors = {};
    if (hasPassword && !current) found.current = "Enter your current password.";
    const problem = newPasswordProblem(next);
    if (problem) found.next = problem;
    setErrors(found);
    if (found.current || found.next) return;

    setBusy(true);
    try {
      await apiFetch<void>("/auth/password", { method: "POST", body: passwordBody(hasPassword, current, next) });
      setCurrent("");
      setNext("");
      toast.success(hasPassword ? "Password changed. Other browsers are signed out." : "Password set. Other browsers are signed out.");
      await client.invalidateQueries({ queryKey: ME_KEY });
    } catch (caught) {
      setErrors(failureErrors(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5" aria-label={hasPassword ? "Change password" : "Set a password"}>
      {hasPassword ? (
        <Field label="Current password" error={errors.current}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
      ) : null}
      <Field label="New password" hint={`${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`} error={errors.next}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>
      {errors.form ? (
        <p className="field-error mt-0" role="alert">
          {errors.form}
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="primary" busy={busy}>
          {hasPassword ? "Change password" : "Set password"}
        </Button>
      </div>
    </form>
  );
}

/** `/account`: who is signed in, the password form and sign out. */
export function AccountView({ initialMe }: { initialMe: Me }) {
  const client = useQueryClient();
  const { user } = useMe().data ?? initialMe;
  return (
    <>
      <PageHeader title="Account" crumbs={[{ label: "Projects", href: "/" }, { label: "Account" }]} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card aria-labelledby="profile-title">
          <CardHeader title="Profile" titleId="profile-title" subtitle="Who you're signed in as" />
          <dl>
            <Row label="Name">{user.name ?? <span className="text-ink-2">No name set</span>}</Row>
            <Row label="Email">
              <span className="break-all">{user.email}</span>
            </Row>
            {user.isAdmin ? (
              <Row label="Role">
                <Pill tone="primary">Admin</Pill>
              </Row>
            ) : null}
          </dl>
        </Card>
        <Card aria-labelledby="password-title">
          <CardHeader
            title={user.hasPassword ? "Change password" : "Set a password"}
            titleId="password-title"
            subtitle={
              user.hasPassword
                ? "Saving a new password signs you out of every other browser."
                : "Sign in with email and password as well as Google. Saving it signs you out of every other browser."
            }
          />
          <PasswordForm hasPassword={user.hasPassword} />
        </Card>
        <Card aria-labelledby="session-title">
          <CardHeader title="Session" titleId="session-title" subtitle="Sessions last 8 hours. Sign out to end this one now." />
          <Button onClick={() => void signOut(client)}>
            <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />
            Sign out
          </Button>
        </Card>
      </div>
    </>
  );
}
