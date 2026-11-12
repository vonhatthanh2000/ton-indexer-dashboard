"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Radar } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import { homeFor, signIn } from "./session-actions";
import { safeNextPath } from "./next-path";

type Role = "admin" | "project";

const COPY: Record<Role, { label: string; hint: string }> = {
  admin: { label: "Admin key", hint: "The ADMIN_API_KEY set on the ton-observer server." },
  project: { label: "Project API key", hint: "The key your admin gave you when the project was created." },
};

function KeyForm({ role, onSuccess }: { role: Role; onSuccess: (role: Role) => void }) {
  const [key, setKey] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = `key-${role}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!key.trim()) {
      setError("Enter your key.");
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(role, key);
      setKey("");
      onSuccess(role);
    } catch (caught) {
      const code = errorCode(caught);
      setError(errorText(caught instanceof ApiError ? { code, field: caught.field, problem: caught.problem } : { code }));
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6">
      <label htmlFor={id} className="field-label">
        {COPY[role].label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          name="key"
          type={visible ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(event) => setKey(event.target.value)}
          className="input mono pr-14"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-2 hover:text-ink"
          aria-label={visible ? "Hide key" : "Show key"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
        </button>
      </div>
      <p id={`${id}-hint`} className="field-hint">
        {COPY[role].hint}
      </p>
      {error ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" busy={busy} className="mt-6 w-full">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export function LoginForm() {
  const params = useSearchParams();
  const client = useQueryClient();
  const expired = params.get("reason") === "expired";
  const next = params.get("next");
  const [tab, setTab] = useState<Role>(next?.startsWith("/project") ? "project" : "admin");

  function onSuccess(role: Role) {
    client.clear();
    window.location.assign(safeNextPath(next, role) ?? homeFor(role));
  }

  return (
    <main id="main" className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="grid size-10 place-items-center rounded-control bg-primary text-surface" aria-hidden="true">
            <Radar size={22} strokeWidth={1.75} />
          </span>
          <span className="text-title font-bold">ton-observer</span>
        </div>
        <div className="card p-8">
          <h1 className="text-title font-semibold">Sign in</h1>
          <p className="mt-1 text-ink-2">Use an admin key to manage projects, or a project key to see its data.</p>
          {expired ? (
            <p role="status" className="mt-5 rounded-control bg-warn-soft px-4 py-3 text-warn">
              {errorText({ code: "session_expired" })}
            </p>
          ) : null}
          <Tabs.Root value={tab} onValueChange={(value) => setTab(value as Role)} className="mt-6">
            <Tabs.List aria-label="Key type" className="grid grid-cols-2 gap-1 rounded-control bg-neutral-soft p-1">
              {(["admin", "project"] as const).map((role) => (
                <Tabs.Trigger
                  key={role}
                  value={role}
                  className="h-11 rounded-sm font-medium text-ink-2 data-[state=active]:bg-surface data-[state=active]:text-ink"
                >
                  {role === "admin" ? "Admin key" : "Project key"}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <Tabs.Content value="admin">
              <KeyForm role="admin" onSuccess={onSuccess} />
            </Tabs.Content>
            <Tabs.Content value="project">
              <KeyForm role="project" onSuccess={onSuccess} />
            </Tabs.Content>
          </Tabs.Root>
        </div>
      </div>
    </main>
  );
}
