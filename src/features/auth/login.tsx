"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Radar } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch, errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import { loginNotice } from "./login-notice";
import { safeNextPath } from "./next-path";

/** Where a password sign-in lands: `next` when it is a safe workspace path, else `/`. */
export function afterLoginPath(next: string | null | undefined): string {
  return safeNextPath(next) ?? "/";
}

// A full page load. Tests swap it: jsdom has no navigation.
function assignLocation(url: string) {
  window.location.assign(url);
}

function PasswordForm({ next, navigate }: { next: string | null; navigate: (url: string) => void }) {
  const client = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) {
      setError("Enter your email.");
      emailRef.current?.focus();
      return;
    }
    if (!password) {
      setError("Enter your password.");
      passwordRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch<void>("/auth/login", { method: "POST", body: { email: email.trim(), password } });
      // A full load, so nothing cached for a previous user survives.
      client.clear();
      navigate(afterLoginPath(next));
    } catch (caught) {
      const code = errorCode(caught);
      setError(errorText(caught instanceof ApiError ? { code, field: caught.field, problem: caught.problem } : { code }));
      setBusy(false);
      setPassword("");
      passwordRef.current?.focus();
    }
  }

  const describedBy = error ? "login-error" : undefined;
  return (
    <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-5" aria-label="Sign in with email">
      <div>
        <label htmlFor="login-email" className="field-label">
          Email
        </label>
        <input
          ref={emailRef}
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          spellCheck={false}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="input"
          aria-describedby={describedBy}
        />
      </div>
      <div>
        <label htmlFor="login-password" className="field-label">
          Password
        </label>
        <div className="relative">
          <input
            ref={passwordRef}
            id="login-password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input pr-14"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-2 hover:text-ink"
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
          >
            {visible ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
          </button>
        </div>
      </div>
      {error ? (
        <p id="login-error" className="field-error mt-0" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" busy={busy} className="w-full">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

/** `/login`: Google, or email and password. The page passes the query in (no useSearchParams). */
export function Login({
  reason,
  error,
  next,
  navigate = assignLocation,
}: {
  reason: string | null;
  error: string | null;
  next: string | null;
  navigate?: (url: string) => void;
}) {
  const notice = loginNotice(reason, error);
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
          <p className="mt-1 text-ink-2">See the projects you belong to.</p>
          {notice ? (
            <p
              role={notice.tone === "err" ? "alert" : "status"}
              className={`mt-5 rounded-control px-4 py-3 ${notice.tone === "err" ? "bg-err-soft text-err" : "bg-warn-soft text-warn"}`}
            >
              {notice.text}
            </p>
          ) : null}
          {/* A full-page navigation on purpose: /auth/google is a route handler that redirects to Google. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/auth/google" className="btn btn-secondary mt-6 w-full">
            Continue with Google
          </a>
          <div className="mt-6 flex items-center gap-3 text-ink-2" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            <span className="text-label">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <PasswordForm next={next} navigate={navigate} />
        </div>
      </div>
    </main>
  );
}
